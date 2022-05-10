import Rete from "rete";
import ConnectionPlugin from "rete-connection-plugin";
import ContextMenuPlugin from "rete-context-menu-plugin";
import AlightRenderPlugin from "rete-alight-render-plugin";
import DockPlugin from "rete-dock-plugin";
import AdvancedSelectionPlugin from "@mbraun/rete-advanced-selection-plugin";

import "./style.css";
import Favicon from "./favicon.png"
import {AddComponent, NumComponent, InputComponent, LogComponent} from "./custom_nodes.js"

document.getElementById("favicon").href = Favicon;

const VERSION = "serverlink@1.0.0";

//need new deep copy for every rete engine
function getComponents() {
  return [new LogComponent(), new InputComponent(), new NumComponent(), new AddComponent()];
}

function setPlugins(editor) {
  editor.use(ConnectionPlugin);
  editor.use(AlightRenderPlugin);
  editor.use(ContextMenuPlugin);
  //plugin handles sidebar "dock", dont need to manually create
  editor.use(DockPlugin, {
    container: document.getElementById('rete_legend'),
    itemClass: 'dock-item', //css class for sidebar
    plugins: [AlightRenderPlugin],
  });
  //default editor cant deselect nodes, on click event only triggered on clicking background, so using this workaround
  editor.on('click', () => {
    editor.selected.clear();
    document.querySelectorAll(".selected").forEach(e => e.classList.remove("selected"));
  });
  editor.use(AdvancedSelectionPlugin);
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

  //need 1 node to start off, else cant drag more nodes from dock
  const placeholder = await components[0].createNode();
  placeholder.position = [0, 0];
  editor.addNode(placeholder);

  editor.on("process", async () => {
    await engine.abort();
    await engine.process(editor.toJSON());
  });
  editor.trigger("process");
  loadHandlers(editor);
}

function loadHandlers(editor) {
  // btn handlers
  document.getElementById("run_btn").onclick = handleRun;
  document.getElementById("load_btn").onclick = handleLoad.bind(null, editor);
  document.getElementById("save_btn").onclick = handleSave.bind(null, editor);
  document.getElementById("settings_btn").onclick = handleSettings;
}
function handleRun() {
  console.log("runHandler");
}

//to keep ui clean, use temporary <input> and <a> elems for file upload n download
function handleLoad(editor) {
  const elem = window.document.createElement('input');
  elem.type = "file";
  elem.onchange = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = evt => {
        editor.fromJSON(JSON.parse(evt.target.result)).catch(evt => alert("Loading json failed\n" + evt));
      };
      reader.onerror = evt => alert("Reading json failed\n" + evt);
    }
  };
  document.body.appendChild(elem);
  elem.click();
  document.body.removeChild(elem);
}
function handleSave(editor) {
  const filename = prompt("Filename");
  if (!filename){
    return;
  }

  const blob = new Blob([JSON.stringify(editor.toJSON())], {type: 'text/json'});
  if(window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveBlob(blob, filename);
  }
  else{
    const elem = window.document.createElement('a');
    elem.href = window.URL.createObjectURL(blob);
    elem.download = filename;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  }
}

function handleSettings() {
  console.log("settingsHandler");
}

window.onload = async function() {
  loadMainpane();
};
