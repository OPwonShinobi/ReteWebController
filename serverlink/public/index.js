import Rete from "rete";
import ConnectionPlugin from "rete-connection-plugin";
import ContextMenuPlugin from "rete-context-menu-plugin";
import AlightRenderPlugin from "rete-alight-render-plugin";
import DockPlugin from "rete-dock-plugin";
import AdvancedSelectionPlugin from "@mbraun/rete-advanced-selection-plugin";
import TaskPlugin from "rete-task-plugin";

import "./style.css";
import Favicon from "./favicon.png";
import {ConditionalComponent, KeydownComponent, LogComponent, MessageSenderComponent, RelayComponent, SpreaderComponent} from "./custom_nodes.js"
import {clearListeners} from "./custom_nodes";

document.getElementById("favicon").href = Favicon;

const VERSION = "serverlink@1.0.0";

//need new deep copy for every rete engine
function getComponents() {
  return [new LogComponent(), new ConditionalComponent(), new SpreaderComponent(), new KeydownComponent(), new MessageSenderComponent(), new RelayComponent()];
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
  //needed for triggering events from outside the editor
  editor.use(TaskPlugin);
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
  //called on graph reloads + field value updates
  editor.on("process", async (args) => {
    if (!args || args["reset"]) {
      await engine.abort();
    }
    await engine.process(editor.toJSON());
  });
  editor.on("connectioncreate connectionremove noderemove", async ()=>{
    if(editor.silent) return;

    clearListeners();
    await engine.abort();
    await engine.process(editor.toJSON());
  });
  editor.trigger("process", {reset:true});
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
  console.log("run triggered", new Date());
  document.dispatchEvent(new CustomEvent("run", {}));
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
      reader.onload = async evt => {
        await editor.fromJSON(JSON.parse(evt.target.result)).catch(evt => alert("Loading json failed\n" + evt));
        //fromJSON silently triggers editor.processed event w.o reset flag, need to reset manually so control constructors properly called
        await editor.trigger("process", {reset:true});
        //bug exists in tasks plugin: running editor.fromJSON will freeze engine until a connectioncreate event is fired after process event
        editor.trigger("connectioncreate");
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
