import Rete from "rete";
import ConnectionPlugin from "rete-connection-plugin";
import ContextMenuPlugin from "rete-context-menu-plugin";
import AlightRenderPlugin from "rete-alight-render-plugin";
import DockPlugin from "rete-dock-plugin";
import AdvancedSelectionPlugin from "@mbraun/rete-advanced-selection-plugin";
import TaskPlugin from "rete-task-plugin";

import "./style.css";
import Favicon from "./favicon.png";
import {
  clearListeners,
  ConditionalComponent,
  KeydownComponent,
  LogComponent,
  MessageSenderComponent,
  RelayComponent,
  SpreaderComponent,
  CustomJsComponent,
  OutputComponent,
  InputComponent
} from "./custom_nodes"
import {displayModal} from "./modal";

document.getElementById("favicon").href = Favicon;

const VERSION = "serverlink@1.0.0";

//need new deep copy for every rete engine
function getComponents() {
  return [new LogComponent(), new ConditionalComponent(), new SpreaderComponent(), new InputComponent(), new OutputComponent(), new CustomJsComponent(), new KeydownComponent(), new MessageSenderComponent(), new RelayComponent()];
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
  editor.on("noderemove", (node) => {
    node.destructor ? node.destructor():null;
  });
  editor.trigger("process", {reset:true});
  loadHandlers(editor);
  loadSave(editor);
}
function loadSave(editor) {
  const savedGraphJson = sessionStorage.getItem("SAVED_GRAPH");
  if (savedGraphJson) {
    //no need for error checking, only way to add save is through valid existing graph
    editor.fromJSON(JSON.parse(savedGraphJson));
  }
  return Boolean(savedGraphJson);
}

function loadHandlers(editor) {
  document.getElementById("run_btn").onclick = handleRun;
  document.getElementById("import_btn").onclick = handleImport.bind(null, editor);
  document.getElementById("export_btn").onclick = handleExport.bind(null, editor);
  document.getElementById("settings_btn").onclick = handleSettings.bind(null, editor);
}
function handleRun() {
  //new ui for selecting run now/later
  console.log("run triggered", new Date());
  document.dispatchEvent(new CustomEvent("run", {}));
}

//to keep ui clean, use temporary <input> and <a> elems for file upload n download
function handleImport(editor) {
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
function handleExport(editor) {
  const filename = prompt("Filename","graph.json");
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

function htmlToElement(html) {
  const template = document.createElement('template');
  html = html.trim();
  template.innerHTML = html;
  return template.content.firstChild;
}

function handleSettings(editor) {
  const isSaved = Boolean(sessionStorage.getItem("SAVED_GRAPH"));
  displayModal(
    htmlToElement(`
    <form style="background-color: white" id="modalForm">
      <h4>Settings</h4>
      <input type="radio" name="loadOnStart" id="loadOnStartOn" disabled ${isSaved ? "checked" : ""}>
      <label for="loadOnStartOn">Saved</label>
      <input type="radio" name="loadOnStart" id="loadOnStartOff" value="off" disabled ${!isSaved ? "checked" : ""}>
      <label for="loadOnStartOff">Unsaved</label>
      <p>Cache actions:</p>
      <button id="saveToCacheBtn">Save To Cache</button>      
      <button id="loadFromCacheBtn">Load From Cache</button>
      <button id="clearFromCacheBtn">Delete From Cache</button>
    </form>
    `)
  );
  document.getElementById("modalForm").onsubmit = () => {return false};
  document.getElementById("saveToCacheBtn").addEventListener("click", function () {
    const graphJson = editor.toJSON();
    if (Object.keys(graphJson.nodes).length) {//verify if empty graph
      sessionStorage.setItem("SAVED_GRAPH", JSON.stringify(graphJson));
      toggleSaveUi();
    } else {
      alert("Graph empty!")
    }
  });
  document.getElementById("loadFromCacheBtn").addEventListener("click", function() {
    const saveExists = loadSave(editor);
    if (!saveExists) {
      alert("No saves exist.\n");
    }
  });
  document.getElementById("clearFromCacheBtn").addEventListener("click", function () {
    sessionStorage.removeItem("SAVED_GRAPH");
    toggleSaveUi();
  });
  const toggleSaveUi = function() {
    const isSaved = Boolean(sessionStorage.getItem("SAVED_GRAPH"));
    document.getElementById("loadOnStartOn").checked = isSaved;
    document.getElementById("loadOnStartOff").checked = !isSaved;
  }
}

window.onload = async function() {
  loadMainpane();
};
