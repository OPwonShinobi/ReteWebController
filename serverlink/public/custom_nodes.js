import Rete from "rete";

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

  constructor(emitter, msg) {
    super("MessageControl");
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
    this.putData("msg", this.scope.value);
    this.emitter.trigger('process', {reset:false});
    this._alight.scan();
  }

  mounted() {
    this.scope.value = this.getData("msg") || "";
    this.update();
  }

  setValue(val) {
    this.scope.value = val;
    this._alight.scan()
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
function cacheChainingValue(node, val) {
  if (val) {
    chainingData[node.id] = val;
  } else {
    chainingData[node.id] = popParentNodeCache(node);
  }
}
//call this in every potential leaf node
function popParentNodeCache(node) {
  const parentId = node.inputs["dat"].connections[0].node;
  let val = null;
  if (chainingData[parentId]) {
    val = chainingData[parentId];
    chainingData[parentId] = null;
  }
  return val;
}

export class ConditionalComponent extends Rete.Component {

  constructor(){
    super("Conditional");
    this.task = {
      outputs: {dat:"option", else_dat:"option"}
    }
  }

  builder(node) {
    node
    .addControl(new MessageControl(this.editor, node.data["msg"]))
    .addInput(new Rete.Input("dat", "data", dataSocket))
    .addOutput(new Rete.Output("dat", "if", dataSocket))
    .addOutput(new Rete.Output("else_dat", "else", dataSocket));
  }
  //called by task.run, no longer by rete
  worker(node, inputs, outputs) {
    if (!inputs) {
      return;
    }
    const inputData = popParentNodeCache(node);
    //set closed to array of non-selected outputs, these are reversed
    const sel = node.data["msg"] === inputData[0] ? "else_dat" : "dat";
    this.closed = [sel];
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

  worker(node, inputs) {
    console.log(node.name, node.id, node.data["msg"], popParentNodeCache(node));
  }
}
const numSocket = new Rete.Socket('Number value');
