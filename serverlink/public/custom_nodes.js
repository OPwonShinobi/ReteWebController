import Rete from "rete";

const actionSocket = new Rete.Socket("Action");
const dataSocket = new Rete.Socket("Data");

const eventHandlers = {
  list: [],
  clear() {
    this.list.forEach(handler => {
      document.removeEventListener("keydown", handler);
    });
    this.list = [];
  },
  add(name, handler) {
    document.addEventListener(name, handler, false);
    this.list.push(handler);
  }
};
export function clearHandlers() {
  eventHandlers.clear();
}
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
    super("Keydown event");
    this.task = {
      outputs: {act: "option", key: "output"},
      init(task, node){
        eventHandlers.add("keydown", function (e) {
          task.run(e.keyCode);
          task.reset();
        });
      }
    }
  }

  builder(node) {
    node.addOutput(new Rete.Output("act", "", actionSocket))
    node.addOutput(new Rete.Output("key", "Key code", dataSocket));
  }

  worker(node, inputs, data) {
    console.log(node.name, node.id, data);
    return {key: data}
  }
}

export class ConditionalComponent extends Rete.Component {

  constructor(){
    super("Conditional");
    this.task = {
      outputs: {then:"option", else:"option"}
    }
  }

  builder(node) {

    node
    .addInput(new Rete.Input("act","", actionSocket))
    .addInput(new Rete.Input("key", "Key code", dataSocket))
    .addOutput(new Rete.Output("then", "Then", actionSocket))
    .addOutput(new Rete.Output("else", "Else", actionSocket));
  }

  worker(node, inputs, outputs) {
    if (inputs && inputs["key"][0] == 13)
      this.closed = ["else"];
    else
      this.closed = ["then"];

    console.log(node.name, node.id, inputs);
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
    .addInput(new Rete.Input("act", "", actionSocket));
  }

  worker(node, inputs) {
    console.log(node.name, node.id, node.data);
    // alert(node.data["msg"]);
  }
}
