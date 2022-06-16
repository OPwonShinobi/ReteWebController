// Create WebSocket connection. Note this runs in App, but is separate from main server
// Connection closes by itself on page refresh. No need to clean up
const socket = new WebSocket('ws://localhost:8081');

// Connection opened
socket.addEventListener('open', function (event) {
  socket.send('Browser connected.');
});

// Listen for messages
socket.addEventListener('message', function (event) {
  console.log('WebSocket Recv:', event.data);

  //figure out what window.event to send (engine listens on event
});

export function sendWebSockMsg(msg) {
  socket.send(msg);
}
export function sendSyncWebSockMsg(msg) {
  socket.send(msg);
  //TODO, wat we gone do, poll here until something is defined?
}