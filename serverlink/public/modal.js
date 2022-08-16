import {EditorView, basicSetup} from "codemirror"
import {javascript, esLint} from "@codemirror/lang-javascript"
import {linter, lintGutter} from "@codemirror/lint";
import Linter from "eslint4b-prebuilt";

export function displayModal(modalContents, onCloseCallback = null) {
  const modal = document.getElementById("modal");
  const modalContentsBox = document.getElementById("modal_contents");
  modalContentsBox.appendChild(modalContents);
  modal.showModal();
  modal.onclose = () => {
    modalContentsBox.innerText = "";
    onCloseCallback ? onCloseCallback() : null;
  };
  modal.onclick = (evt) => {
    //clicked outside
    if (document.body.contains(evt.target) && !modalContentsBox.contains(evt.target)) {
      modal.close();
    }
  }
}

export function displayTextEditor(initVal, updateValCallBack) {
  const elem = document.createElement("div");
  const codeEditor = new EditorView({
    doc: initVal,
    extensions: [
      basicSetup,
      javascript(),
      lintGutter(),
      linter(esLint(new Linter(), {
        "parserOptions": {
          "ecmaFeatures": {
            "globalReturn": true
          }
        },
        "env": {
          "es6": true
        },
        "rules": {}
      })),
    ],
    parent: elem
  });
  const updateOnClose = function() {
    updateValCallBack(codeEditor.state.sliceDoc());
  };
  displayModal(elem, updateOnClose);
}
