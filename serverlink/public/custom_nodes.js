import Rete from "rete";
import {JunctionTemplate, ConditionalNodeTemplate, SpreaderTemplate} from './custom_templates';
import {WebSockFields, WebSockType} from "./web_socket_client";
const actionSocket = new Rete.Socket("Action");

import {v4} from "uuid";
import {
  ButtonControl,
  DropdownControl,
  TextFileControl,
  isMainpane,
  MessageControl,
  RadioControl,
  DataUrlFileControl
} from "./custom_controls";
const dataSocket = new Rete.Socket("Data");
actionSocket.combineWith(dataSocket);

var WEB_SOCK_PORT = 0;
export async function loadWebSockSettings() {
  await fetch("/config?type=setting&name=ws_port")
  .then(rsp => rsp.json())
  .then(port =>
    WEB_SOCK_PORT = port
  );
}
//client side only ws socket cache. Sockets are untracked on server side
const wsSocketCache = {
  sockets: new Map(),
  addConnection(nodeId) {
    let wsSocket = this.sockets.get(nodeId);
    if (!wsSocket) {
      wsSocket = new WebSocket('ws://localhost:' + WEB_SOCK_PORT);
      this.sockets.set(nodeId, wsSocket);
    }
    return wsSocket;
  },
  closeConnection(nodeId) {
    this.sockets.get(nodeId).close();
    this.sockets.delete(nodeId);
  },
  getConnection(nodeId) {
    return this.sockets.get(nodeId);
  }
};
const eventListenerCache = {
  listeners: new Map(),
  addListener(id, name, handler) {
    if (this.listeners.get(id)) {
      this.removeListener(id);
    }
    document.addEventListener(name, handler, false);
    this.listeners.set(id, {name: name, handler: handler});
  },
  removeListener(id) {
    if (this.listeners.get(id)) {
      const listener = this.listeners.get(id);
      document.removeEventListener(listener.name, listener.handler);
      this.listeners.delete(id);
    }
  }
};

const chainingData = {};

function sendHttpReq(socket, data, endpointData) {
  const req = {};
  req[WebSockFields.TYPE] = WebSockType.HTTP;
  req[WebSockFields.ENDPOINT] = JSON.parse(endpointData);//backend needs this as json
  req[WebSockFields.PAYLOAD] = data;
  socket.send(JSON.stringify(req));
}
function getOutputChildCount(node, key) {
  return node.outputs[key].connections.length;
}

function runCustomCode(funcStr, inputData) {
//funcStr can be null, new Function still runs
  const func = new Function("$INPUT", funcStr);
  let outputData = null;
  try {outputData = func(inputData);}
  catch (e) {
    outputData = e;
  }
  return outputData;
}
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
    .addControl(new TextFileControl(this.editor, node.data, "text"));
  }
  worker(node) {
    const funcStr = node.data["textfile"];
    const inputData = popParentNodeCache(node);
    const outputData = runCustomCode(funcStr, inputData);
    cacheChainingValue(node, "dat", outputData);
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
    //input only used so MessageSenderNode can trigger it
    .addInput(new Rete.Input("dat", "data", dataSocket))
    .addOutput(new Rete.Output("dat", "data", dataSocket))
    .addControl(new DataUrlFileControl(this.editor, node.data, "blob"));
  }
  worker(node) {
    //data stored under <key> + "file"
    cacheChainingValue(node, "dat", {file: node.data["blobfile"], data: popParentNodeCache(node)});
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
    cacheChainingValue(node, "act", String(data));
  }
}

export class MessageSenderNode extends Rete.Component {

  constructor(){
    super("Message Sender");
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
    cacheChainingValue(node, "act", String(node.data["msg"]));
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
    cacheChainingValue(node, "dat", popParentNodeCache(node));
  }
}
//call this in every chainable node
//if val given, save it to current cache. else pop it from parent cache
function cacheChainingFifoValue(node, key, val) {
  const childCount = getOutputChildCount(node, key);
  if (childCount) {
    if (!chainingData[node.id]) {
      chainingData[node.id] = {fifo: []};
    }
    chainingData[node.id].fifo.push({childCount: childCount, data: val});
  }
}

function cacheChainingValue(node, key, val) {
  const childCount = getOutputChildCount(node, key);
  if (childCount) {
    chainingData[node.id] = {childCount: childCount, data: val};
  }
}
//bypass caching logic, just shove value into cache
function forceCacheChainingValue(node, val) {
  chainingData[node.id] = val;
}
function popParentNodeCache(node) {
  //node saves child node id in "node" field, not id field
  const parentId = node.inputs["dat"].connections[0].node;
  return popSingleParentCache(parentId);
}
function popFifoObj(parentId) {
  const fifoElem = chainingData[parentId].fifo[0];
  const cacheData = fifoElem.data;
  fifoElem.childCount--;
  if (fifoElem.childCount <= 0) {
    chainingData[parentId].fifo.shift();
  }
  if (chainingData[parentId].fifo.length <= 0) {
    delete chainingData[parentId];
  }
  return cacheData;
}
function popMultiChildObj(parentId) {
  const cacheData = chainingData[parentId].data;
  chainingData[parentId].childCount--;
  if (chainingData[parentId].childCount <= 0) {
    delete chainingData[parentId];
  }
  return cacheData;
}
function popSingleParentCache(parentId) {
  let cacheData = null;
  if (chainingData[parentId] != null) {
    if (chainingData[parentId].fifo) {
      cacheData = popFifoObj(parentId);
    } else if (chainingData[parentId].childCount) {
      cacheData = popMultiChildObj(parentId);
    }
  }
  return cacheData;
}
function popMultiParentNodeCache(node) {
  let cacheData = null;
  //popParentNodeCache with many potential parents
  for(const key in node.inputs) {
    const inputConns = node.inputs[key].connections;
    if (inputConns.length) {
      const parentId = inputConns[0].node;
      cacheData = popSingleParentCache(parentId);
      if (cacheData != null) break;
    }
  }
  return cacheData;
}

export class ConditionalNode extends Rete.Component {

  constructor(){
    super("Conditional");
    this.task = {
      "outputs": {"else":"option", "opt0":"option"}
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
    const ctrl = new TextFileControl(this.editor, this.node["data"], key);
    this.node.addControl(ctrl);
    const output = new Rete.Output(key, "else if", dataSocket);
    this.node.addOutput(output)
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
    .addOutput(new Rete.Output("else", "else", dataSocket))
    .addOutput(new Rete.Output(defaultCond, "if", dataSocket))
    .addControl(new TextFileControl(this.editor, this.node["data"], defaultCond));

    //extra conditions
    for(const key in this.node["data"]) {
      if (key === defaultCond) continue;
      if (!key.includes("file"))
        this.addCond(key);
    }
  }
  worker(node) {
    const data = popParentNodeCache(node);
    //set closed to array of non-selected outputs, these are reversed
    this.closed = [];
    let matches = 0;
    for (const key in node.outputs) {
      if (key === "else") {continue;}
      if (!getOutputChildCount(node, key)) {continue;}
      const funcStr = node.data[key + "file"];
      const isMatch = Boolean(runCustomCode(funcStr, data));
      if (isMatch) {
        matches++;
        cacheChainingValue(node, key, data);
      } else {
        this.closed.push(key);
      }
    }

    if (matches > 0) {
      this.closed.push("else");
    } else {
      cacheChainingValue(node, "else", data);
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
    console.log("Logger id \\ msg \\ data:", node.id, node.data["msg"], popParentNodeCache(node));
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
    .addControl(new TextFileControl(this.editor, node.data, "endpoint_config"))
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
        cacheChainingValue(node, "dat", data.payload);//data -> payload
        this.closed = ["err"];
      } else {
        cacheChainingValue(node, "err", data);//data -> status + error payload
        this.closed = ["dat"];
      }
      //now allow propagation
    } else {
    //1st run, worker called by parent node
      const cachedSocket = wsSocketCache.getConnection(node.id);
      const cachedData = popParentNodeCache(node);
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
            && rsp[document.WebSockFields.NAME] === src.node.data["msg"]) {
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
    cacheChainingValue(node, "dat", data);
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
    const spreadData = popParentNodeCache(node);
    // keep closed empty, do not close any connections: send to all child nodes
    this.closed = [];
    for (const key in node.outputs) {
      cacheChainingValue(node, key, spreadData);
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
    .addOutput(new Rete.Output("dat", "data", dataSocket));
    for (const key in this.node["data"]) {
      this.addIn(key);
    }
  }
  worker(node) {
    const data = popMultiParentNodeCache(node);
    cacheChainingFifoValue(node, "dat", data);
  }
}
export class RepeaterNode extends Rete.Component {
  constructor(){
    super("Repeater");
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
    .addControl(new TextFileControl(this.editor, node.data, "loopsFunc"))
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
      //disable propagation on first run
      this.closed = ["dat"];
      const cachedData = popParentNodeCache(node);
      let totalLoops = 1; //by default run once
      if (node.data["loops"]) {
        totalLoops = parseInt(node.data["loops"]);
      } else if (node.data["loopsFuncfile"]) {
        totalLoops = parseInt(runCustomCode(node.data["loopsFuncfile"], data));
      }
      const childCount = getOutputChildCount(node, "dat");
      const dataToBeCached = {childCount: totalLoops * childCount, data: cachedData};
      forceCacheChainingValue(node, dataToBeCached);
      for (let i = 0; i < totalLoops; i++) {
        document.dispatchEvent(new CustomEvent("loop", {detail:node.id}));
      }
    }
    //from 2nd run onwards, dont do anything, data already cached. Let tasks handle
  }
}