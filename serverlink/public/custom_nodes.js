import Rete from "rete";

class NumControl extends Rete.Control {

  constructor(emitter, key, readonly) {
    super(key);
    this.emitter = emitter;
    this.template = '<input type="number" :value="value" @input="change($event)" :readonly="readonly" />';
    this.props = { emitter, ikey: key, readonly };
    this.scope = {
      value: 0,
      change: this.change.bind(this)
    };
  }

  change(e){
    this.scope.value = +e.target.value;
    this.update();
  }

  update(){
    this.putData('num', this.scope.value)
    this.emitter.trigger('process');
    this._alight.scan();
  }

  mounted() {
    this.scope.value = this.getData('num') || 0;
    this.update();
  }

  setValue(val) {
    this.scope.value = val;
    this._alight.scan()
  }
}

const numSocket = new Rete.Socket('Number value');

export class NumComponent extends Rete.Component {
  constructor(){
    super("Number");
  }
  builder(node) {
    var out1 = new Rete.Output('num', "Number", numSocket);
    return node.addControl(new NumControl(this.editor, 'num')).addOutput(out1);
  }

  worker(node, inputs, outputs) {
    outputs['num'] = node.data.num;
  }
}

export class AddComponent extends Rete.Component {
  constructor(){
    super("Add");
  }

  builder(node) {
    const inp1 = new Rete.Input('num',"Input1", numSocket);
    const inp2 = new Rete.Input('num2', "Input2", numSocket);
    const out = new Rete.Output('num', "output", numSocket);

    inp1.addControl(new NumControl(this.editor, 'num'))
    inp2.addControl(new NumControl(this.editor, 'num2'))

    return node
    .addInput(inp1)
    .addInput(inp2)
    .addControl(new NumControl(this.editor, 'preview', true))
    .addOutput(out);
  }

  worker(node, inputs, outputs) {
    const n1 = inputs['num'].length?inputs['num'][0]:node.data.num1;
    const n2 = inputs['num2'].length?inputs['num2'][0]:node.data.num2;
    const sum = n1 + n2;
    //node param is minified obj, needs var "controls" which is only in full obj from parent
    const fullObj = this.editor.nodes.find(n => n.id === node.id);
    //during load, editor will have 0 nodes
    if (fullObj && fullObj.controls && fullObj.controls.get("preview")) {
      fullObj.controls.get("preview").setValue(sum);
    }
    outputs['num'] = sum;
  }
}

export class LogComponent extends Rete.Component {
  constructor(){
    super("Log");
    this.HEIGHT = 200;
  }

  builder(node) {
    const inp1 = new Rete.Input('str',"Input1", numSocket);
    //might add logging to server log in future
    return node
    .addInput(inp1)
  }

  worker(node, inputs) {
    const n1 = inputs['str'];
    if (n1)
      console.log()
  }
}

export class InputComponent extends Rete.Component {
  constructor(){
    super("Input");
  }

  builder(node) {
    const inp1 = new Rete.Input('num',"Input1", numSocket);
    const inp2 = new Rete.Input('num2', "Input2", numSocket);
    const out = new Rete.Output('num', "output", numSocket);

    inp1.addControl(new NumControl(this.editor, 'num'))
    inp2.addControl(new NumControl(this.editor, 'num2'))

    return node
    .addInput(inp1)
    .addInput(inp2)
    .addControl(new NumControl(this.editor, 'preview', true))
    .addOutput(out);
  }

  worker(node, inputs, outputs) {
    const n1 = inputs['num'].length?inputs['num'][0]:node.data.num1;
    const n2 = inputs['num2'].length?inputs['num2'][0]:node.data.num2;
    const sum = n1 + n2;
    //node param is minified obj, needs var "controls" which is only in full obj from parent
    this.editor.nodes.find(n => n.id == node.id).controls.get("preview").setValue(sum)
    outputs['num'] = sum;
  }
}