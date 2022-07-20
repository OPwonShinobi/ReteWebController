export function displayModal(modalContents) {
  const modal = document.getElementById("modal");
  const modalContentsBox = document.getElementById("modal_contents");
  modalContentsBox.appendChild(modalContents);
  modal.showModal();
  modal.onclose = () => {
    modalContentsBox.innerText = "";
  };
  modal.onclick = (evt) => {
    //clicked outside
    if (!modalContentsBox.contains(evt.target)) {
      modal.close();
    }
  }
}
