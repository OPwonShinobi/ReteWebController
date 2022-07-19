// Create WebSocket connection. Note this runs in App, but is separate from main server
// Connection closes by itself on page refresh. No need to clean up
export class WebSockType {
  static BROADCAST = "broadcast";
  static HTTP = "http";
  static INVALID = "err";
}
//rete worker scope cant access these unless made part of document body
document.WebSockType = WebSockType;
export class WebSockFields {
  static TYPE = "type";
  static NAME = "name";
  static PAYLOAD = "payload";
  static ENDPOINT = "endpoint";
}
document.WebSockFields = WebSockFields;

