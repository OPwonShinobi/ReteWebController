import Rete from "rete";
import {ConditionalNodeTemplate, SplitterTemplate} from './custom_templates';

const actionSocket = new Rete.Socket("Action");
const dataSocket = new Rete.Socket("Data");
actionSocket.combineWith(dataSocket);

const eventListeners = {
  list: [],
  keys: new Set(),
  clear() {
    this.list.forEach(e => {
      document.removeEventListener(e.name, e.handler);
    });
    this.list = [];
    this.keys.clear();
  },
  add(id, name, handler) {
    if (this.keys.has(id)) {
      return;
    }
    this.keys.add(id);
    document.addEventListener(name, handler, false);
    this.list.push({name: name, handler: handler});
  }
};
export function clearListeners() {
  eventListeners.clear();
}
const chainingData = {};

class MessageControl extends Rete.Control {

  constructor(emitter, msg, key) {
    const thisKey = key || "msg";
    super(thisKey);
    this.key = thisKey;
    this.emitter = emitter;
    this.template = `<input :value="msg" @input="change($event)"/>`;

    this.scope = {
      msg,
      change: this.change.bind(this)
    };
  }

  change(e) {
    this.scope.value = e.target.value;
    this.update();
  }

  update() {
    this.putData(this.key, this.scope.value);
    this.emitter.trigger('process', {reset:false});
    this._alight.scan();
  }

  mounted() {
    this.scope.value = this.getData(this.key) || "";
    this.update();
  }

  setValue(val) {
    this.scope.value = val;
    this._alight.scan()
  }
}
class ButtonControl extends Rete.Control {
  constructor(key, display, clickFunc, parentObj) {
    const thisKey = key || "btn";
    super(thisKey);
    this.key = thisKey;
    this.clickFunc = clickFunc;
    this.template = `<button class="${display}" @click="onClick($event)">${display}</button>`;
    this.scope = {
      onClick : () => {
        this.clickFunc.bind(parentObj)();
      }
    }
  }
}
export class KeydownComponent extends Rete.Component {

  constructor(){
    super("Keydown Listener");
    this.task = {
      outputs: {act: "option"},
      init(task, node){
        eventListeners.add(node.id, "keydown", function (e) {
          task.run(e.keyCode);
          task.reset();
        });
      }
    }
  }

  builder(node) {
    node.addOutput(new Rete.Output("act", "trigger", actionSocket));
  }

  worker(node, inputs, data) {
    console.log(node.name, node.id, data);
    cacheChainingValue(node, String(data));
  }
}

export class MessageSenderComponent extends Rete.Component {

  constructor(){
    super("Message Sender");
    this.task = {
      outputs: {act: "option"},
      init(task, node){
        eventListeners.add(node.id, "run", function (e) {
          if (!node.data["msg"]) {
            alert("Run cancelled. msg can't be empty!");
            return;
          }
          task.run();
          task.reset();
        });
      }
    }
  }

  builder(node) {
    node
    .addControl(new MessageControl(this.editor, node.data["msg"]))
    .addOutput(new Rete.Output("act", "trigger", actionSocket));
  }

  worker(node) {
    cacheChainingValue(node, node.data["msg"]);
  }
}
export class RelayComponent extends Rete.Component {
  //workaround to tasks.run only working properly for first 2 nodes in chain
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
  worker(node, inputs) {
    if (!inputs) {
      return;
    }
    cacheChainingValue(node, inputs["dat"]);
  }
}
//call this in every chainable node
//if val given, save it to current cache. else pop it from parent cache
function cacheChainingValue(node, val) {
  if (val) {
    chainingData[node.id] = val;
  } else {
    chainingData[node.id] = popParentNodeCache(node);
  }
}
//call this in every chainable or potential leaf node
function popParentNodeCache(node) {
  //node saves child node id in "node" field, not id field
  const parentId = node.inputs["dat"].connections[0].node;
  const childId = node.id;
  let cacheData = null;
  if (chainingData[parentId]) {
    if (chainingData[parentId].hasCopies) {
      cacheData = chainingData[parentId][childId];
      delete chainingData[parentId][childId];
    }
    if (!chainingData[parentId].hasCopies) {
      cacheData = chainingData[parentId];
      chainingData[parentId] = {};
    }

    if (chainingData[parentId] === {}) {
      delete chainingData[parentId];
    }
  }
  return cacheData;
}

export class ConditionalComponent extends Rete.Component {

  constructor(){
    super("Conditional");
    this.task = {
      "outputs": {"else":"option", "opt0":"option"}
    };
    this.condPairs = {};
    this.data.template = ConditionalNodeTemplate;
  }
  getLastIdx(){
    const keys = Object.keys(this.task["outputs"]).sort();
    return parseInt(keys[keys.length-1].substring("opt".length));
  }
  removeHandler() {
    const idx = this.getLastIdx();
    if (!idx) {
      return
    }
    const key = "opt" + idx;
    //cant set null, need to delete to remove key
    delete this.task["outputs"][key];
    this.node.removeControl(this.condPairs[key]["ctrl"]);
    this.node.removeOutput(this.condPairs[key]["output"]);
    try {this.editor.trigger('nodeselected', {node:this.node});} catch (error) {}
  }
  addHandler() {
    const newKey = "opt" + (this.getLastIdx()+1);
    this.addCond(newKey);
    //this triggers some alight error. but still works, so ignoring
    try {this.editor.trigger('nodeselected', {node:this.node});} catch (error) {}
  }
  addCond(key){
    const ctrl = new MessageControl(this.editor, this.node["data"][key], key);
    this.node.addControl(ctrl);
    const output = new Rete.Output(key, "else if", dataSocket);
    this.node.addOutput(output)
    this.task["outputs"][key] = "option";
    this.condPairs[key] = {"ctrl": ctrl, "output":output};
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
    .addControl(new MessageControl(this.editor, this.node["data"][defaultCond], defaultCond));

    //extra conditions
    if (Object.keys(this.node["data"]).length !== 0) {
      for(const key in this.node["data"]) {
        if (key !== defaultCond) {
          this.addCond(key);
        }
      }
    }
  }
  //called by task.run, no longer by rete, dont have access to most instance data
  worker(node, inputs) {
    if (!inputs) {return;}
    const inputData = popParentNodeCache(node);
    //set closed to array of non-selected outputs, these are reversed
    this.closed = [];
    let matches = [];
    for (const key in node.outputs) {
      if (key === "else") {continue;}
      //for now, splitting func on conditional node is disabled
      if (!matches.length && inputData === node.data[key]) {
        matches.push(key);
      } else {
        this.closed.push(key);
      }
    }
    if (matches.length) {
      this.closed.push("else");
    }
    cacheChainingValue(node, inputData);
  }
}

export class LogComponent extends Rete.Component {

  constructor() {
    super("Log");
    this.task = {
      outputs: {}
    }
  }

  builder(node) {
    node
    .addControl(new MessageControl(this.editor, node.data["msg"]))
    .addInput(new Rete.Input("dat", "data", dataSocket));
  }

  worker(node) {
    console.log(node.name, node.id, node.data["msg"], popParentNodeCache(node));
  }
}

export class SpreaderComponent extends Rete.Component {

  constructor(){
    super("Spreader");
    this.task = {
      "outputs": {"opt0":"option"}
    };
    this.data.template = SplitterTemplate;
  }
  getLastIdx(){
    const keys = Object.keys(this.task["outputs"]).sort();
    return parseInt(keys[keys.length-1].substring("opt".length));
  }
  removeHandler() {
    const idx = this.getLastIdx();
    if (!idx) {
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
    this.node = node ?? this.node;
    //default options
    const defaultOut = "opt0";
    this.node
    .addInput(new Rete.Input("dat", "data", dataSocket))
    .addControl(new ButtonControl("add", "Add", this.addHandler, this))
    .addControl(new ButtonControl("delete", "Delete", this.removeHandler, this))
    //default output
    .addOutput(new Rete.Output(defaultOut, "data", dataSocket));

    //extra outputs
    if (Object.keys(this.node["data"]).length !== 0) {
      for(const key in this.node["data"]) {
        this.addOut(key);
      }
    }
  }
  worker(node, inputs) {
    if (!inputs) {return;}
    const spreadData = popParentNodeCache(node);
    // keep closed empty, do not close any connections: send to all child nodes
    this.closed = [];
    const dataToSave = {hasCopies: true};
    for (const key in node.outputs) {
      if (node.outputs[key].connections.length > 0) {
        //childId saved in connection.node field
        const childId = node.outputs[key].connections[0].node;
        dataToSave[childId] = spreadData;
      }
    }
    cacheChainingValue(node, dataToSave);
  }
}