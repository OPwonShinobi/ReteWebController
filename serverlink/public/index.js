import Rete from "rete";
import ConnectionPlugin from 'rete-connection-plugin';
import VueRenderPlugin from 'rete-vue-render-plugin';
import ContextMenuPlugin from 'rete-context-menu-plugin';

import './style.css';
import Favicon from "./favicon.png"

document.getElementById("favicon").href = Favicon;

const VERSION = 'serverlink@1.0.0';
const numSocket = new Rete.Socket('Number value');
const VueNumControl = {
  props: ['readonly', 'emitter', 'ikey', 'getData', 'putData'],
  template: '<input type="number" :readonly="readonly" :value="value" @input="change($event)" @dblclick.stop="" @pointerdown.stop="" @pointermove.stop=""/>',
  data() {
    return {
      value: 0,
    }
  },
  methods: {
    change(e){
      this.value = +e.target.value;
      this.update();
    },
    update() {
      if (this.ikey)
        this.putData(this.ikey, this.value)
      this.emitter.trigger('process');
    }
  },
  mounted() {
    this.value = this.getData(this.ikey);
  }
}

class NumControl extends Rete.Control {
  constructor(emitter, key, readonly) {
    super(key);
    this.component = VueNumControl;
    this.props = { emitter, ikey: key, readonly };
  }

  setValue(val) {
    this.vueContext.value = val;
  }
}

class NumComponent extends Rete.Component {
  constructor(){
    super("Number");
    this.HEIGHT = 130;
  }
  builder(node) {
    var out1 = new Rete.Output('num', "Number", numSocket);
    return node.addControl(new NumControl(this.editor, 'num')).addOutput(out1);
  }

  worker(node, inputs, outputs) {
    outputs['num'] = node.data.num;
  }
}

class AddComponent extends Rete.Component {
  constructor(){
    super("Add");
    this.HEIGHT = 200;
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
//need new deep copy for every rete engine
function getComponents() {
  return [new NumComponent(), new AddComponent()]
}
async function loadSidebar(){
  const components = getComponents();
  const container = document.querySelector('#rete_legend');
  const editor = new Rete.NodeEditor(VERSION, container);
  editor.use(VueRenderPlugin);
  editor.use(ContextMenuPlugin);
  editor.use(ConnectionPlugin);

  //need to register all comps to editor + engine
  const engine = new Rete.Engine(VERSION);
  components.map(c => {
    editor.register(c);
    engine.register(c);
  });
  let offset = 0;
  for (let i = 0; i < components.length; i++) {
    const node = await components[i].createNode();
    node.position = [10,  offset];
    editor.addNode(node);
    offset += components[i].HEIGHT;
  }

  await engine.process(editor.toJSON());
  document.querySelector("#rete_legend").style["overflow"] = "visible"
  editor.on('nodetranslate', () => {
    return false;
  });
  editor.on('nodeselect', (node) => {
    console.log(node.position);
  });
}
async function loadMainpane() {
  const container = document.querySelector('#rete');
  const components = getComponents()
  const editor = new Rete.NodeEditor(VERSION, container);
  editor.use(ConnectionPlugin);
  editor.use(VueRenderPlugin);
  editor.use(ContextMenuPlugin);

  const engine = new Rete.Engine(VERSION);
  components.map(c => {
    editor.register(c);
    engine.register(c);
  });

  const n1 = await components[0].createNode({num: 2});
  const n2 = await components[0].createNode({num: 0});
  const add = await components[1].createNode();

  n1.position = [80, 200];
  n2.position = [80, 400];
  add.position = [500, 240];


  editor.addNode(n1);
  editor.addNode(n2);
  editor.addNode(add);
1
  editor.connect(n1.outputs.get('num'), add.inputs.get('num'));
  editor.connect(n2.outputs.get('num'), add.inputs.get('num2'));


  editor.on('process nodecreated noderemoved connectioncreated connectionremoved', async () => {
    await engine.abort();
    await engine.process(editor.toJSON());
  });
  editor.trigger('process');
// without this, nothing shows up. Possibly something to do w. editor.view.resize(), leaving this here as temp fix
  document.querySelector("#rete").style["overflow"] = "visible";
}

window.onload = async function(e) {
  loadMainpane();
  loadSidebar();
};
