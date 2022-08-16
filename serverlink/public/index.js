import Rete from "rete";
import ConnectionPlugin from "rete-connection-plugin";
import ContextMenuPlugin from "rete-context-menu-plugin";
import AlightRenderPlugin from "rete-alight-render-plugin";
import DockPlugin from "rete-dock-plugin";
import AdvancedSelectionPlugin from "@mbraun/rete-advanced-selection-plugin";
import TaskPlugin from "rete-task-plugin";
import AreaPlugin from "rete-area-plugin";
import CommentPlugin from "rete-comment-plugin";

import "./style.css";
import Favicon from "./favicon.png";
import {
  clearListeners,
  ConditionalNode,
  KeydownNode,
  LogNode,
  MessageSenderNode,
  RelayNode,
  SpreaderNode,
  CustomJsNode,
  OutputNode,
  InputNode,
  CombinerNode,
  FileInputNode,
  RepeaterNode,
  loadWebSockSettings,
} from "./custom_nodes"
import {displayModal} from "./modal";
import {loadEndPoints} from "./custom_controls";

document.getElementById("favicon").href = Favicon;

//need new deep copy for every rete engine
function getComponents() {
  return [new LogNode(), new ConditionalNode(), new SpreaderNode(), new CombinerNode(), new InputNode(), new OutputNode(), new CustomJsNode(), new KeydownNode(), new MessageSenderNode(), new RelayNode(), new FileInputNode(), new RepeaterNode()];
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
  editor.use(AreaPlugin);
  editor.use(CommentPlugin, { margin: 50 });
}


async function loadMainpane() {
  const version = await fetch("/config?type=setting&name=graph_version")
  .then(rsp => rsp.text())
  .then(rspData => {
    return rspData;
  });
  const container = document.querySelector("#rete");
  const editor = new Rete.NodeEditor(version, container);
  setPlugins(editor);
  const engine = new Rete.Engine(version);
  //need to register all comps to editor + engine
  getComponents().map(c => {
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

    await engine.abort();
    await engine.process(editor.toJSON());
  });
  editor.on("noderemove", (node) => {
    node.destructor ? node.destructor():null;
  });
  editor.trigger("process", {reset:true});
  loadHandlers(editor);
  await loadEndPoints();
  await loadWebSockSettings();
  loadSave(editor);
}
async function loadSave(editor) {
  const savedGraphJson = sessionStorage.getItem("SAVED_GRAPH");
  if (savedGraphJson) {
    //no need for error checking, only way to add save is through valid existing graph
    await forceReload(editor, JSON.parse(savedGraphJson));
  }
  return Boolean(savedGraphJson);
}

function loadHandlers(editor) {
  document.getElementById("run_btn").onclick = handleRun;
  document.getElementById("import_btn").onclick = handleImport.bind(null, editor);
  document.getElementById("export_btn").onclick = handleExport.bind(null, editor);
  document.getElementById("settings_btn").onclick = handleSettings.bind(null, editor);
  document.getElementById("node_search_bar").onchange = handleSearch;
}
function handleRun() {
  //new ui for selecting run now/later
  console.log("Run all triggered", new Date());
  document.dispatchEvent(new CustomEvent("run", {}));
}
async function forceReload(editor, graphJson) {
  await editor.fromJSON(graphJson);
  AreaPlugin.zoomAt(editor);
  //fromJSON silently triggers editor.processed event w.o reset flag, need to reset manually so control constructors properly called
  await editor.trigger("process", {reset:true});
  //bug exists in tasks plugin: running editor.fromJSON will freeze engine until a connectioncreate event is fired after process event
  editor.trigger("connectioncreate");
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
        await forceReload(editor, JSON.parse(evt.target.result))
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
  if(navigator.msSaveOrOpenBlob) {
    navigator.msSaveBlob(blob, filename);
  }
  else{
    const elem = document.createElement('a');
    elem.href = URL.createObjectURL(blob);
    elem.download = filename;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
    URL.revokeObjectURL(elem.href);
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
    <div>
      <h4>Settings</h4>
      <input type="radio" name="loadOnStart" id="loadOnStartOn" disabled ${isSaved ? "checked" : ""}>
      <label for="loadOnStartOn">Saved</label>
      <input type="radio" name="loadOnStart" id="loadOnStartOff" value="off" disabled ${!isSaved ? "checked" : ""}>
      <label for="loadOnStartOff">Unsaved</label>
      <p>Cache actions:</p>
      <button id="saveToCacheBtn">Save To Cache</button>      
      <button id="loadFromCacheBtn">Load From Cache</button>
      <button id="clearFromCacheBtn">Delete From Cache</button>
    </div>
    `)
  );
  document.getElementById("saveToCacheBtn").addEventListener("click", function () {
    const graphJson = editor.toJSON();
    if (Object.keys(graphJson.nodes).length) {//verify if empty graph
      sessionStorage.setItem("SAVED_GRAPH", JSON.stringify(graphJson));
      toggleSaveUi();
    } else {
      alert("Graph empty!")
    }
  });
  document.getElementById("loadFromCacheBtn").addEventListener("click", async function() {
    const saveExists = await loadSave(editor);
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
function handleSearch(e) {
  const searchTerm = e.target.value;
  let elem;
  if (!searchTerm) {
    return;
  } else {
    //firefox uses xpath 1, need to use this workaround
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const xpath = `//div[@id='rete_legend']//div[contains(@class,'title')][contains(
      translate(., '${alphabet.toUpperCase()}', '${alphabet}'),'${searchTerm.toLowerCase()}'
    )]`;
    elem = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  }
  elem ? elem.scrollIntoView() : null;
}
window.onload = async function() {
  loadMainpane();
};
