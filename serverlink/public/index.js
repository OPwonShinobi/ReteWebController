import Rete from "rete";
import ConnectionPlugin from "rete-connection-plugin";
import ContextMenuPlugin from "rete-context-menu-plugin";
import AlightRenderPlugin from "rete-alight-render-plugin";
import DockPlugin from 'rete-dock-plugin';

import "./style.css";
import Favicon from "./favicon.png"
import {AddComponent, NumComponent} from "./custom_nodes.js"

document.getElementById("favicon").href = Favicon;

const VERSION = "serverlink@1.0.0";

//need new deep copy for every rete engine
function getComponents() {
  return [new NumComponent(), new AddComponent()];
}

function setPlugins(editor) {
  editor.use(ConnectionPlugin);
  editor.use(AlightRenderPlugin);
  //
  editor.use(ContextMenuPlugin);
  //plugin handles sidebar "dock", dont need to manually create
  editor.use(DockPlugin, {
    container: document.querySelector('#rete_legend'),
    itemClass: 'dock-item', //css class for sidebar
    plugins: [AlightRenderPlugin],
  });
}

async function loadMainpane() {
  const container = document.querySelector("#rete");
  const components = getComponents()
  const editor = new Rete.NodeEditor(VERSION, container);
  setPlugins(editor);
  const engine = new Rete.Engine(VERSION);
  //need to register all comps to editor + engine
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

  editor.connect(n1.outputs.get("num"), add.inputs.get("num"));
  editor.connect(n2.outputs.get("num"), add.inputs.get("num2"));

  editor.on("process nodecreated noderemoved connectioncreated connectionremoved", async () => {
    await engine.abort();
    await engine.process(editor.toJSON());
  });
  editor.trigger("process");
// without this, nothing shows up. Possibly something to do w. editor.view.resize(), leaving this here as temp fix
  document.querySelector("#rete").style["overflow"] = "visible";
  loadHandlers();
}

function loadHandlers() {
  // btn handlers
  document.getElementById("run_btn").onclick = handleRun;
  document.getElementById("load_btn").onclick = handleLoad;
  document.getElementById("save_btn").onclick = handleSave;
  document.getElementById("settings_btn").onclick = handleSettings;
}
function handleRun() {
  console.log("runHandler");
}
function handleLoad() {
  console.log("loadHandler");
}
function handleSave() {
  console.log("saveHandler");
}
function handleSettings() {
  console.log("settingsHandler");
}

window.onload = async function(e) {
  // loadSidebar();
  loadMainpane();
};
