import Rete from "rete";

const actionSocket = new Rete.Socket("Action");
const dataSocket = new Rete.Socket("Data");

const eventListeners = {
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
export function clearListeners() {
  eventListeners.clear();
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
    super("Keydown Listener");
    this.task = {
      outputs: {act: "option", dat: "output"},
      init(task, node){
        eventListeners.add("keydown", function (e) {
          task.run(e.keyCode);
          task.reset();
        });
      }
    }
  }

  builder(node) {
    node.addOutput(new Rete.Output("act", "action", actionSocket))
    node.addOutput(new Rete.Output("dat", "data", dataSocket));
  }

  worker(node, inputs, data) {
    console.log(node.name, node.id, data);
    return {dat: data}
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
    .addControl(new MessageControl(this.editor, node.data["msg"]))
    .addInput(new Rete.Input("act","action", actionSocket))
    .addInput(new Rete.Input("dat", "data", dataSocket))
    .addOutput(new Rete.Output("then", "then", actionSocket))
    .addOutput(new Rete.Output("else", "else", actionSocket));
  }

  worker(node, inputs, outputs) {
    if (!inputs) {
      return;
    }
    if (node.data["msg"] == inputs["dat"])
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
    .addInput(new Rete.Input("act", "action", actionSocket))
    .addInput(new Rete.Input("dat", "data", dataSocket));
  }

  worker(node, inputs) {
    console.log(node.name, node.id, node.data["msg"], inputs["dat"] || "");
  }
}
