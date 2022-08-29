import Rete from "rete";
import {JunctionTemplate, ConditionalNodeTemplate, SpreaderTemplate} from './custom_templates';

import {v4} from "uuid";
import {
  ButtonControl,
  DropdownControl,
  TextFileControl,
  isMainpane,
  MessageControl,
  DataUrlFileControl
} from "./custom_controls";
import {
  sendHttpReq,
  runCustomCode,
  getOutputChildCount,
  eventListenerCache,
  wsSocketCache,
  nodeDataCache
} from "./node_utils";
//workaround for browser optimization making debugging hard
let nodeCache = nodeDataCache;

const dataSocket = new Rete.Socket("Data");
const actionSocket = new Rete.Socket("Action");
actionSocket.combineWith(dataSocket);

export class CustomJsNode extends Rete.Component {
  constructor(){
    super("CustomJs");
    this.task = {
      outputs: {dat:"option"}
    }
  }
  builder(node) {
    node
    .addInput(new Rete.Input("dat", "data", dataSocket))
    .addOutput(new Rete.Output("dat", "data", dataSocket))
    .addControl(new TextFileControl(this.editor, node.data, "text", true));
  }
  worker(node) {
    const funcStr = node.data["textfile"];
    const inputData = nodeCache.popParentNodeCache(node);
    const outputData = runCustomCode(funcStr, inputData);
    nodeCache.cacheChainingValue(node, "dat", outputData);
  }
}
export class FileInputNode extends Rete.Component {
  constructor(){
    super("File");
    this.task = {
      outputs: {dat:"option"}
    }
  }
  builder(node) {
    node
    //input only used so RunnerNode can trigger it
    .addInput(new Rete.Input("dat", "data", dataSocket))
    .addOutput(new Rete.Output("dat", "data", dataSocket))
    .addControl(new DataUrlFileControl(this.editor, node.data, "blob"));
  }
  worker(node) {
    //data stored under <key> + "file"
    const cacheData = nodeCache.popParentNodeCache(node);
    nodeCache.cacheChainingValue(node, "dat", {file: node.data["blobfile"], data: cacheData});
  }
}
export class KeydownNode extends Rete.Component {

  constructor(){
    super("Keydown Listener");
    this.task = {
      outputs: {"act": "option"},
      init(task, node){
        //note, task plugin calls init func on ANY rete event, even events from other nodes
        //each init call will break scope of previous inits, making events not work. Need to reattach listeners
        //or replace callback funcs w. fresh closure func
        eventListenerCache.addListener(node.id, "keydown", function (e) {
          task.run(e.key);
          task.reset();
        });
      }
    };
  }

  builder(node) {
    node.addOutput(new Rete.Output("act", "trigger", actionSocket));
    node.destructor = function () {
      eventListenerCache.removeListener(this.id);
    }
  }

  worker(node, inputs, data) {
    console.log(node.name, node.id, data);
    nodeCache.cacheChainingValue(node, "act", data);
  }
}

export class RunnerNode extends Rete.Component {

  constructor(){
    super("Run");
    this.task = {
      outputs: {"act": "option"},
      init(task, node){
        eventListenerCache.addListener(node.id, "run", function (e) {
          if (!e.detail || e.detail === node.id) {
            task.run();
            task.reset();
          }
        });
      }
    }
  }

  run(nodeId) {
    console.log("Run triggered from node", nodeId, new Date());
    document.dispatchEvent(new CustomEvent("run", {detail:nodeId}));
  }

  builder(node) {
    node
    .addControl(new MessageControl(this.editor, node.data["msg"]))
    .addControl(new ButtonControl("runTrigger", "Run", this.run.bind(null, node.id), this))
    .addOutput(new Rete.Output("act", "trigger", actionSocket));
    node.destructor = function() {
      eventListenerCache.removeListener(node.id);
    };
  }

  worker(node) {
    nodeCache.cacheChainingValue(node, "act", String(node.data["msg"]));
  }
}
export class RelayNode extends Rete.Component {
  constructor(){
    super("Relay");
    this.task = {
      outputs: {dat:"option"}
    }
  }

  builder(node) {
    node
    .addInput(new Rete.Input("dat", "data", dataSocket))
    .addOutput(new Rete.Output("dat", "data", dataSocket));
  }
  worker(node) {
    nodeCache.cacheChainingValue(node, "dat", nodeCache.popParentNodeCache(node));
  }
}


export class ConditionalNode extends Rete.Component {

  constructor(){
    super("Conditional");
    this.task = {
      "outputs": {"else":"option", "opt0":"option"},
      init(task, node){
        eventListenerCache.addListener(node.id, "cond", function (e) {
          if (e.detail.id === node.id) {
            task.run(e.detail.data);
            task.reset();
          }
        });
      }
    };
    this.data.template = ConditionalNodeTemplate;
  }
  getLastIdx(){
    const keys = Object.keys(this.task["outputs"]).sort();
    return parseInt(keys[keys.length-1].substring("opt".length));
  }
  removeHandler() {
    const idx = this.getLastIdx();
    if (!idx) {
      //do not allow removing default conditions "opt0" or "else"
      return
    }
    const key = "opt" + idx;
    const output = this.node.outputs.get(key);
    if (output.hasConnection()) {
      this.editor.removeConnection(output.connections[0]);
    }
    delete this.task["outputs"][key];
    this.node.removeControl(this.node.controls.get(key));
    delete this.node.data[key + "file"];
    delete this.node.data[key + "filename"];
    this.node.removeOutput(this.node.outputs.get(key));
    try {this.editor.trigger('nodeselected', {node:this.node});} catch (error) {}
  }
  addHandler() {
    const newKey = "opt" + (this.getLastIdx()+1);
    this.addCond(newKey);
    //this triggers some alight error. but still works, so ignoring
    try {this.editor.trigger('nodeselected', {node:this.node});} catch (error) {}
  }
  addCond(key){
    const ctrl = new TextFileControl(this.editor, this.node["data"], key, true);
    this.node.addControl(ctrl);
    const output = new Rete.Output(key, "else if", actionSocket);
    this.node.addOutput(output);
    this.task["outputs"][key] = "option";
  }
  builder(node) {
    this.node = node ?? this.node;
    const defaultCond = "opt0";
    //default options
    this.node
    .addInput(new Rete.Input("dat", "data", dataSocket))
    .addControl(new ButtonControl("add", "Add", this.addHandler, this))
    .addControl(new ButtonControl("delete", "Delete", this.removeHandler, this))
    //due to tech limitation, else must be first
    .addOutput(new Rete.Output("else", "else", actionSocket))
    .addOutput(new Rete.Output(defaultCond, "if", actionSocket))
    .addControl(new TextFileControl(this.editor, this.node["data"], defaultCond, true));

    //extra conditions
    for(const key in this.node["data"]) {
      if (key === defaultCond) continue;
      if (!key.includes("file"))
        this.addCond(key);
    }
  }
  worker(node, input, parentData) {
    if (!parentData) {
      //1st run
      const data = nodeCache.popParentNodeCache(node);
      let matches = 0;
      let closed2ndRun = [];
      for (const key in node.outputs) {
        this.closed.push(key);
        if (key === "else") {continue;}
        const funcStr = node.data[key + "file"];
        const isMatch = Boolean(runCustomCode(funcStr, data));
        if (isMatch) {
          matches++;
          nodeCache.cacheChainingValue(node, key, data);
        } else {
          closed2ndRun.push(key);
        }
      }
      if (matches > 0) {
        closed2ndRun.push("else");
      } else {
        nodeCache.cacheChainingValue(node, "else", data);
      }
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent("cond", {detail: {id: node.id, data: closed2ndRun}}));
      },100);
    } else {
      //2nd run
      this.closed = parentData;
    }
  }
}

export class LogNode extends Rete.Component {

  constructor() {
    super("Log");
    //even tho task is unused here, still need empty task.outputs obj or tasks plugin will complain
    this.task = {outputs: {}}
  }

  builder(node) {
    node
    .addControl(new MessageControl(this.editor, node.data["msg"]))
    .addInput(new Rete.Input("dat", "data", dataSocket));
  }

  worker(node) {
    console.log("Logger id \\ msg \\ data:", node.id, node.data["msg"], nodeCache.popParentNodeCache(node));
  }
}

export class OutputNode extends Rete.Component {
  constructor() {
    super("Output");
    this.task = {
      outputs: {"dat":"option", "err":"option"},
      init(task, node) {
        const wsSocket = wsSocketCache.addConnection(node.id);
        if (!wsSocket) return;
        wsSocket.onmessage = function (event) {
          const rsp = JSON.parse(event.data);
          if (rsp[document.WebSockFields.TYPE] === document.WebSockType.BROADCAST)//ignore messages intended for input nodes
            return;
          task.run(rsp);
          task.reset();
        };
      }
    }
  }
  builder(node) {
    function setupEndpointConfigs() {
      fetch("/config?type=endpoint&name=" + node.data["endpoint_name"])
        .then(rsp => rsp.json())
        .then(rspJson => {
          node.data["endpoint_configfile"] = JSON.stringify(rspJson, null, 4);
      });
    }
    node.data["endpoint_configfilename"] = node.data["endpoint_configfilename"] || "endpoint settings";

    node
    .addControl(new DropdownControl(this.editor, "endpoint_name", node.data["endpoint_name"], "endpoint", setupEndpointConfigs))
    .addControl(new TextFileControl(this.editor, node.data, "endpoint_config", false))
    .addInput(new Rete.Input("dat", "data", dataSocket))
    .addOutput(new Rete.Output("dat", "trigger", actionSocket))
    .addOutput(new Rete.Output("err", "error", actionSocket));
    node.destructor = function() {
      wsSocketCache.closeConnection(node.id);
    };
  }
  //called twice, once by parent node, once by socket.onmessage after ws backend returns response
  worker(node, inputs, data) {
    if (data) {
    //2nd run, worker called by websock
      const isSuccess = data.status === 200;
      if (isSuccess) {
        nodeCache.cacheChainingValue(node, "dat", data.payload);//data -> payload
        this.closed = ["err"];
      } else {
        nodeCache.cacheChainingValue(node, "err", data);//data -> status + error payload
        this.closed = ["dat"];
      }
      //now allow propagation
    } else {
    //1st run, worker called by parent node
      const cachedSocket = wsSocketCache.getConnection(node.id);
      const cachedData = nodeCache.popParentNodeCache(node);
      sendHttpReq(cachedSocket, cachedData, node.data["endpoint_configfile"]);
      this.closed = ["dat","err"]; //prevent propagation until second run
    }
  }
}


export class InputNode extends Rete.Component {
  constructor() {
    super("Input");
    const src = this;
    this.task = {
      outputs: {"dat": "option"},
      init(task, node) {
        const wsSocket = wsSocketCache.addConnection(node.id);
        if (!wsSocket) return;
        wsSocket.onmessage = function (event) {
          const rsp = JSON.parse(event.data);
          if (rsp[document.WebSockFields.TYPE] === document.WebSockType.BROADCAST
            && rsp[document.WebSockFields.NAME] === node.data["msg"]) {
            task.run(rsp[document.WebSockFields.PAYLOAD]);
            task.reset();
          }
        };
      }
    }
  }

  builder(node) {
    const endpointName = isMainpane(this.editor) ? (node.data["msg"] || v4()) : "";
    node
    .addControl(new MessageControl(this.editor, endpointName, "msg"))
    .addOutput(new Rete.Output("dat", "trigger", actionSocket));
    node.destructor = function() {
      wsSocketCache.closeConnection(node.id);
    };
  }
  worker(node, inputs, data) {
    nodeCache.cacheChainingValue(node, "dat", data);
  }
}

export class SpreaderNode extends Rete.Component {

  constructor(){
    super("Spreader");
    this.task = {
      "outputs": {"opt0":"option"}
    };
    this.data.template = SpreaderTemplate;
  }
  getLastIdx(){
    const keys = Object.keys(this.task["outputs"]).sort();
    return parseInt(keys[keys.length-1].substring("opt".length));
  }
  removeHandler() {
    const idx = this.getLastIdx();
    if (!idx) {
      //do not allow removing default condition "opt0"
      return
    }
    const key = "opt" + idx;
    //need to remove connections before removing output
    const output = this.node.outputs.get(key);
    if (output.hasConnection()) {
      this.editor.removeConnection(output.connections[0]);
    }
    this.node.removeOutput(output);
    //cant set null, need to delete to remove key
    delete this.task["outputs"][key];
    //unlike cond node, only spreader node saves outputs as extra data for reloading graph.
    delete this.node.data[key];
    //removing output often doesnt trigger ui refresh, send refresh manually
    try {this.editor.trigger('nodeselected', {node:this.node});} catch (error) {}
  }
  addHandler() {
    const newKey = "opt" + (this.getLastIdx()+1);
    this.addOut(newKey);
    //this triggers some alight error. but still works, so ignoring
    try {this.editor.trigger('nodeselected', {node:this.node});} catch (error) {}
  }
  addOut(key){
    this.node.addOutput(new Rete.Output(key, "data", dataSocket))
    this.task["outputs"][key] = "option";
    //builder does not load node outputs from json, so save it to node data as workaround
    this.node.data[key] = "option"; //placeholder data
  }
  builder(node) {
    //need to save node to this context, addOut needs to reference it
    this.node = node;
    //default options
    const defaultOut = "opt0";
    this.node
    .addInput(new Rete.Input("dat", "data", dataSocket))
    .addControl(new ButtonControl("add", "Add", this.addHandler, this))
    .addControl(new ButtonControl("delete", "Delete", this.removeHandler, this))
    //default output
    .addOutput(new Rete.Output(defaultOut, "data", dataSocket));

    //extra outputs
    for(const key in this.node["data"]) {
      this.addOut(key);
    }
  }
  worker(node) {
    const spreadData = nodeCache.popParentNodeCache(node);
    // keep closed empty, do not close any connections: send to all child nodes
    this.closed = [];
    for (const key in node.outputs) {
      nodeCache.cacheChainingValue(node, key, spreadData);
    }
  }
}

export class JunctionNode extends Rete.Component {

  constructor() {
    super("Junction");
    this.task = {
      "outputs": {"dat": "option"}
    };
    this.data.template = JunctionTemplate;
  }

  getLastIdx() {
    const keys = Array.from(this.node.inputs.keys()).sort();
    return parseInt(keys[keys.length - 1].substring("opt".length));
  }

  removeHandler() {
    const idx = this.getLastIdx();
    if (!idx) {
      return
    }
    const key = "opt" + idx;
    const input = this.node.inputs.get(key);
    if (input.hasConnection()) {
      this.editor.removeConnection(input.connections[0]);
    }
    this.node.removeInput(input);
    delete this.node.data[key];
    try {
      this.editor.trigger('nodeselected', {node: this.node});
    } catch (error) {
    }
  }

  addHandler() {
    const newKey = "opt" + (this.getLastIdx() + 1);
    this.addIn(newKey);
    try {
      this.editor.trigger('nodeselected', {node: this.node});
    } catch (error) {
    }
  }

  addIn(key) {
    this.node.addInput(new Rete.Input(key, "data", dataSocket))
    this.node.data[key] = "option";
  }
  builder(node) {
    //need to save node to this context, addOut needs to reference it
    this.node = node;
    //default options
    this.node
    .addInput(new Rete.Input("opt0", "data", dataSocket))
    .addControl(new ButtonControl("add", "Add", this.addHandler, this))
    .addControl(new ButtonControl("delete", "Delete", this.removeHandler, this))
    .addOutput(new Rete.Output("dat", "data", actionSocket));
    for (const key in this.node["data"]) {
      this.addIn(key);
    }
  }
  worker(node) {
    const data = nodeCache.popMultiParentNodeCache(node);
    nodeCache.cacheChainingValue(node, "dat", data);
  }
}
export class LoopNode extends Rete.Component {
  constructor(){
    super("Loop");
    this.task = {
      outputs: {dat:"option"},
      init(task, node){
        eventListenerCache.addListener(node.id, "loop", function (e) {
          if (e.detail === node.id) {
            task.run("dummy data");
            task.reset();
          }
        });
      }
    }
  }
  builder(node) {
    node.data["loopsFuncfilename"] = node.data["loopsFuncfilename"] || "calculate loops";

    node
    .addControl(new MessageControl(this.editor, node.data["loops"] || "10", "loops"))
    .addControl(new TextFileControl(this.editor, node.data, "loopsFunc", true))
    .addInput(new Rete.Input("dat", "data", dataSocket))
    .addOutput(new Rete.Output("dat", "data", actionSocket));

    node.destructor = function() {
      eventListenerCache.removeListener(node.id);
    };
  }
  //at least 2 calls
  worker(node, input, data) {
    //first run
    if (!data) {
      const cachedData = nodeCache.popParentNodeCache(node);
      let totalLoops = 1; //by default run once
      if (node.data["loops"]) {
        totalLoops = parseInt(node.data["loops"]);
      } else if (node.data["loopsFuncfile"]) {
        totalLoops = parseInt(runCustomCode(node.data["loopsFuncfile"], data));
      }
      const childCount = getOutputChildCount(node, "dat");
      nodeCache.cacheValueWithChildCount(node, cachedData, totalLoops * childCount);
      //rete task plugin uses BFS, current node will run N times before any child node called
      //so including current run, run child nodes N-1 more times
      for (let i = 1; i < totalLoops; i++) {
        document.dispatchEvent(new CustomEvent("loop", {detail:node.id}));
      }
    }
    //from 2nd run onwards, dont do anything, data already cached. Let tasks handle
  }
}