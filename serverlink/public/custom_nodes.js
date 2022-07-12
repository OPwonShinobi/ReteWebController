import Rete from "rete";
import {ConditionalNodeTemplate, SpreaderTemplate} from './custom_templates';
import {displayModal} from "./modal";
import {WebSockFields, WebSockType, WebSockUtils} from "./web_socket_client";
const actionSocket = new Rete.Socket("Action");

import {v4} from "uuid";
// const uuid = require("uuid");
const dataSocket = new Rete.Socket("Data");
actionSocket.combineWith(dataSocket);

var ws_port = 0;
fetch("/config?type=setting&name=ws_port")
.then(rsp => rsp.json())
.then(port =>
  ws_port = port
);
var endpointNames = [];
fetch("/config?type=endpoint")
.then(rsp => rsp.json())
.then(rspData => {
  if (rspData.length === 0) {
    alert("No endpoints added! Output nodes unusable.");
  }
  endpointNames = rspData;
}).catch(err => {
  console.error("Error fetching node endpoints:" + err);
});

const wsSocketCache = new Map();
const eventListeners = {
  list: [],
  keys: new Set(),
  clear() {
    this.list.forEach(e => {
      document.removeEventListener(e.name, e.handler);
    });
    this.list = [];
    this.keys.clear();
    wsSocketCache.clear();
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

function outputHasChildNodes(node, key) {
  return node.outputs[key].connections.length > 0;
}

class MessageControl extends Rete.Control {
  constructor(emitter, msg, key) {
    const thisKey = key || "msg";
    super(thisKey);
    this.key = thisKey;
    this.emitter = emitter;
    this.template = `<input :value="msg" @input="change($event)" @pointermove.stop=""/>`;
    this.scope = {
      msg,
      change: this.changeHandler.bind(this)
    };
  }
  changeHandler(e) {
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
    this.clickFunc = clickFunc;
    this.template = `<button class="${display}" @click="onClick($event)">${display}</button>`;
    this.scope = {
      onClick : this.clickFunc.bind(parentObj)
    }
  }
}
class FileControl extends Rete.Control {
  constructor(emitter, data, key) {
    const thisKey = key || "file";
    super(thisKey);
    this.emitter = emitter;
    this.key = thisKey;
    data = data || {};
    const filename = data[key + "filename"];
    const file = data[key + "file"];
    this.template = `
      <input :value="filename" @dblclick="loadFile($event)" @input="renameFile($event)" @pointermove.stop=""/>
      <input :value="file" style="display: none"/>
      <button @click="showFile($event)">Show</button>`;
    this.scope = {
      file,
      filename,
      loadFile: this.loadHandler.bind(this),
      showFile: this.showHandler.bind(this),
      renameFile: this.renameHandler.bind(this)
    }
  }
  update() {
    this.putData(this.key, "");
    this.putData(this.key + "filename", this.scope.filename);
    this.putData(this.key + "file", this.scope.file);
    this.emitter.trigger('process', {reset:false});
    this._alight.scan();
  }
  showHandler(e) {
    const jsDisplay = document.createElement("textarea");
    jsDisplay.value = this.getData(this.key + "file")
    jsDisplay.onchange = (() => {
      this.scope.file = jsDisplay.value;
      this.update();
    }).bind(this);
    displayModal(jsDisplay);
  }
  loadHandler(e) {
    const elem = window.document.createElement('input');
    elem.type = "file";
    const parent = this;
    elem.onchange = e => {
      const file = e.target.files[0];
      if (file) {
        //setting filename input thru code will not trigger renameHandler
        parent.scope.filename = file.name;
        const reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        reader.onload = async evt => {
          parent.scope.file = evt.target.result;
          parent.update();
        };
      }
    };
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  }
  renameHandler(e) {
    this.scope.filename = e.target.value;
    this.update();
  }
  mounted() {
    this.scope.file = this.getData(this.key + "file") || "";
    this.scope.filename = this.getData(this.key + "filename") || "";
    this.update();
  }
}

class RadioControl extends Rete.Control {
  constructor(key, group, isChecked, selected) {
    super(key);
    this.initChecked = key === selected || isChecked;
    this.template =`${key}<input type="radio" :checked=${this.initChecked} name="${group}" value="${key}" @change="onChange($event)"/>`;
    this.scope = {
      onChange: this.changeHandler.bind(this),
    }
  }
  update(isChecked) {
    if (isChecked)
      this.putData("selected", this.key);
    this._alight.scan();
  }
  changeHandler(e) {
    this.update(e.target.checked);
  }
  mounted() {
    this.update(this.initChecked);
  }
}
class DropdownControl extends Rete.Control {
  constructor(emitter, key, selected, configType) {
    super(key);
    this.emitter = emitter;
    this.template =`<select :value="selected" @change="onChange($event)" @pointermove.stop="">`;
    this.scope = {
      selected,
      onChange: this.changeHandler.bind(this),
      optionClicked: this.optionClickHandler.bind(this),
    };
    if (isMainpane(emitter) && configType === "endpoint") {
      endpointNames.forEach(name => {
        this.template += `<option value="${name}" ${name === selected ? "selected":""} @click="optionClicked($event)">${name}</option>`
      });
      this.template += `</select>`
    }
  }
  changeHandler(e) {
    this.scope.selected = e.target.value;
    this.update();
  }
  optionClickHandler(e) {
    this.emitter.trigger("click");//click background, workaround for node staying selected after option clicked
  }
  mounted() {
    this.scope.selected = this.getData(this.key) || "";
    this.update();
  }
  update() {
    this.putData(this.key, this.scope.selected);
    this._alight.scan();
  }
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
export class CustomJsComponent extends Rete.Component {
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
    .addControl(new FileControl(this.editor, node.data));
  }
  worker(node) {
    const funcStr = node.data["file"];
    const inputData = popParentNodeCache(node);
    const outputData = runCustomCode(funcStr, inputData)
    cacheChainingValue(node, outputData);
  }
}
export class KeydownComponent extends Rete.Component {

  constructor(){
    super("Keydown Listener");
    this.task = {
      outputs: {"act": "option"},
      init(task, node){
        eventListeners.add(node.id, "keydown", function (e) {
          task.run(e.key);
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
    //outputs different for every node, this check need to go in worker func
    if (outputHasChildNodes(node, "act")) {
      cacheChainingValue(node, String(data));
    }
  }
}

export class MessageSenderComponent extends Rete.Component {

  constructor(){
    super("Message Sender");
    this.task = {
      outputs: {"act": "option"},
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
    if (outputHasChildNodes(node, "act")) {
      cacheChainingValue(node, String(node.data["msg"]));
    }
  }
}
export class RelayComponent extends Rete.Component {
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
    cacheChainingValue(node);
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
function popCurrentNodeCache(node) {
  return chainingData[node.id];
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

    if (!Object.keys(chainingData[parentId]).length) {
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
    const ctrl = new FileControl(this.editor, this.node["data"][key], key);
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
    .addControl(new FileControl(this.editor, this.node["data"][defaultCond], defaultCond));

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
    const dataToBeCached = {hasCopies: true};
    for (const key in node.outputs) {
      if (key === "else") {continue;}
      if (node.outputs[key].connections.length === 0) {continue;}
      const funcStr = node.data[key + "file"];
      const isMatch = Boolean(runCustomCode(funcStr, data));
      if (isMatch) {
        matches++;
        const childId = node.outputs[key].connections[0].node;
        dataToBeCached[childId] = data;
      } else {
        this.closed.push(key);
      }
    }

    if (matches > 0) {
      this.closed.push("else");
    } else {
      const elseClause = node.outputs["else"].connections;
      if (elseClause.length) {
        const childId = elseClause[0].node;
        dataToBeCached[childId] = data;
      }
    }
    cacheChainingValue(node, dataToBeCached);
  }
}

export class LogComponent extends Rete.Component {

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
    let data = popParentNodeCache(node);
    console.log(`Logger id: ${node.id}, msg: ${node.data["msg"]}, data: ${JSON.stringify(data)}`);
  }
}

export class OutputComponent extends Rete.Component {
  constructor() {
    super("Output");
    const parent = this;
    this.task = {
      outputs: {"dat":"option"},
      init(task) {
        parent.socket.onmessage = function (event) {
          const rsp = JSON.parse(event.data);
          if (["RENAME", "BROADCAST"].includes(rsp["TYPE"]))
            return;
          task.run(event.data, parent);
          task.reset();
        };
      }
    }
  }
  builder(node) {
    this.node = node;
    createWsConnection(this);
    if (this.socket) {
      wsSocketCache.set(node.id, this.socket); //workaround for worker method needing this.socket
    }
    node
    .addControl(new DropdownControl(this.editor, "endpoint_picker", node.data["endpoint_picker"], "endpoint"))
    .addInput(new Rete.Input("dat", "data", dataSocket))
    .addOutput(new Rete.Output("dat", "trigger", actionSocket));
  }
  //called twice, once by parent node, once after ws backend returns response
  worker(node, inputs, data) {
    if (data) {
      //2nd run, worker called by websock
      if (outputHasChildNodes(node, "dat")) {
        cacheChainingValue(node, data);
      }
    } else {
      //1st run, worker called by parent node
      const cachedSocket = wsSocketCache.get(node.id);
      const cachedData = popParentNodeCache(node);
      const req = {};
      req[WebSockFields.ENDPOINT] = node.data["endpoint_picker"];
      sendHttpReq(cachedSocket, req, cachedData);
      this.closed = ["dat"]; //prevent propagation until second run
    }
  }
}
function createWsConnection(src) {
  //is main pane and not side bar editor
  if (isMainpane(src.editor)) {
    src.socket = new WebSocket('ws://localhost:' + ws_port);
    src.oldName = src.node.data["msg"] || v4(); //default to random uuid for new nodes
    src.socket.onopen = function () { //slight inconsistent delay before socket open
      sendRenameReq(src);
    }.bind(src);
    src.node.destructor = function() {
      src.socket.close();
      wsSocketCache.delete(src.node.id);
    };
  }
}
function isMainpane(editor) {
  return editor.components.size > 0;
}
function sendRenameReq(src) {
  const req = {};
  req[WebSockFields.TYPE] = WebSockType.RENAME;
  req[WebSockFields.OLD_NAME] = src.oldName;
  req[WebSockFields.NEW_NAME] = src.node.data["msg"] || src.oldName;
  src.oldName = src.node.data["msg"] || src.oldName;
  src.socket.send(JSON.stringify(req));
}
function sendHttpReq(socket, req, data) {
  req[WebSockFields.TYPE] = WebSockType.HTTP;
  req[WebSockFields.PAYLOAD] = data;
  socket.send(JSON.stringify(req));
}

export class InputComponent extends Rete.Component {
  constructor() {
    super("Input");
    const parent = this;
    this.task = {
      outputs: {"dat": "option"},
      init(task) {
        parent.socket.onmessage = function (event) {
          const rsp = JSON.parse(event.data);
          if (rsp["TYPE"] === "RENAME")
              return;
          task.run(event.data);
          task.reset();
        };
      }
    }
  }

  builder(node) {
    this.node = node;
    createWsConnection(this);
    node
    .addControl(new MessageControl(this.editor, node.data["msg"]))
    .addControl(new ButtonControl("SetConnName","Save", this.setConnName, this))
    .addOutput(new Rete.Output("dat", "trigger", actionSocket));
  }
  setConnName() {
    if (!this.node.data["msg"]) {
      alert("Saved connection name cannot be empty");
      return;
    }
    sendRenameReq(this);
  }
  worker(node, inputs, data) {
    if (outputHasChildNodes(node, "dat")) {
      cacheChainingValue(node, data);
    }
  }
}

export class SpreaderComponent extends Rete.Component {

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
    const dataToSave = {hasCopies: true};
    for (const key in node.outputs) {
      if (outputHasChildNodes(node, key)) {
        //childId saved in connection.node field
        const childId = node.outputs[key].connections[0].node;
        dataToSave[childId] = spreadData;
      }
    }
    cacheChainingValue(node, dataToSave);
  }
}