export function displayModal(modalContents) {
  const modal = document.getElementById("modal");
  const modalClose = document.getElementById("modal-close");
  const modalContentsBox = document.getElementById("modal-contents");

  modalClose.onclick = e => {
    modalContentsBox.innerHTML = ""
    modal.style.display = "none";
    modalClose.onclick = null;
  };

  modalContentsBox.appendChild(modalContents);
  modal.style.display = "block";
}
