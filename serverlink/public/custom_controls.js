import Rete from "rete";
import {displayModal} from "./modal";

var endpointNames = [];
fetch("/config?type=endpoint")
.then(rsp => rsp.json())
.then(rspData => {
  if (rspData.length === 0) {
    alert("No endpoints added! Output nodes unusable.");
  }
  endpointNames = rspData;
}).catch(err => {
  console.error("Error fetching node endpoints:" + err);
});

export class MessageControl extends Rete.Control {
  constructor(emitter, msg, key) {
    const thisKey = key || "msg";
    super(thisKey);
    this.key = thisKey;
    this.emitter = emitter;
    this.template = `<input :value="msg" @input="change($event)" @pointermove.stop=""/>`;
    this.scope = {
      msg,
      change: this.changeHandler.bind(this)
    };
  }
  changeHandler(e) {
    this.scope.value = e.target.value;
    this.update();
  }
  update() {
    this.putData(this.key, this.scope.value);
    this.emitter.trigger('process', {reset:false});
    this._alight.scan();
  }
  mounted() {
    this.scope.value = this.getData(this.key) || "";
    this.update();
  }
  setValue(val) {
    this.scope.value = val;
    this._alight.scan()
  }
}
export class ButtonControl extends Rete.Control {
  constructor(key, display, clickFunc, parentObj) {
    const thisKey = key || "btn";
    super(thisKey);
    this.clickFunc = clickFunc;
    this.template = `<button class="${display}" @click="onClick($event)">${display}</button>`;
    this.scope = {
      onClick : this.clickFunc.bind(parentObj)
    }
  }
}
export class FileControl extends Rete.Control {
  constructor(emitter, data, key) {
    const thisKey = key || "file";
    super(thisKey);
    this.emitter = emitter;
    this.key = thisKey;
    data = data || {};
    const filename = data[key + "filename"];
    const file = data[key + "file"];
    this.template = `
      <input :value="filename" @dblclick="loadFile($event)" @input="renameFile($event)" @pointermove.stop=""/>
      <input :value="file" style="display: none"/>
      <button @click="showFile($event)">Show</button>`;
    this.scope = {
      file,
      filename,
      loadFile: this.loadHandler.bind(this),
      showFile: this.showHandler.bind(this),
      renameFile: this.renameHandler.bind(this)
    }
  }
  update() {
    this.putData(this.key, "");
    this.putData(this.key + "filename", this.scope.filename);
    this.putData(this.key + "file", this.scope.file);
    this.emitter.trigger('process', {reset:false});
    this._alight.scan();
  }
  showHandler(e) {
    const jsDisplay = document.createElement("textarea");
    jsDisplay.value = this.getData(this.key + "file")
    jsDisplay.onchange = (() => {
      this.scope.file = jsDisplay.value;
      this.update();
    }).bind(this);
    displayModal(jsDisplay);
  }
  loadHandler(e) {
    const elem = window.document.createElement('input');
    elem.type = "file";
    const parent = this;
    elem.onchange = e => {
      const file = e.target.files[0];
      if (file) {
        //setting filename input thru code will not trigger renameHandler
        parent.scope.filename = file.name;
        const reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        reader.onload = async evt => {
          parent.scope.file = evt.target.result;
          parent.update();
        };
      }
    };
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  }
  renameHandler(e) {
    this.scope.filename = e.target.value;
    this.update();
  }
  mounted() {
    this.scope.file = this.getData(this.key + "file") || "";
    this.scope.filename = this.getData(this.key + "filename") || "";
    this.update();
  }
}

export class RadioControl extends Rete.Control {
  constructor(key, group, isChecked, selected) {
    super(key);
    this.initChecked = key === selected || isChecked;
    this.template =`${key}<input type="radio" :checked=${this.initChecked} name="${group}" value="${key}" @change="onChange($event)"/>`;
    this.scope = {
      onChange: this.changeHandler.bind(this),
    }
  }
  update(isChecked) {
    if (isChecked)
      this.putData("selected", this.key);
    this._alight.scan();
  }
  changeHandler(e) {
    this.update(e.target.checked);
  }
  mounted() {
    this.update(this.initChecked);
  }
}
export function isMainpane(editor) {
  return editor.components.size > 0;
}
export class DropdownControl extends Rete.Control {
  constructor(emitter, key, selected, configType) {
    super(key);
    this.emitter = emitter;
    this.template =`<select :value="selected" @change="onChange($event)" @pointermove.stop="">`;
    this.scope = {
      selected,
      onChange: this.changeHandler.bind(this),
      optionClicked: this.optionClickHandler.bind(this),
    };
    if (isMainpane(emitter) && configType === "endpoint") {
      endpointNames.forEach(name => {
        this.template += `<option value="${name}" ${name === selected ? "selected":""} @click="optionClicked($event)">${name}</option>`
      });
      this.template += `</select>`
    }
  }
  changeHandler(e) {
    this.scope.selected = e.target.value;
    this.update();
  }
  optionClickHandler(e) {
    this.emitter.trigger("click");//click background, workaround for node staying selected after option clicked
  }
  mounted() {
    this.scope.selected = this.getData(this.key) || "";
    this.update();
  }
  update() {
    this.putData(this.key, this.scope.selected);
    this._alight.scan();
  }
}