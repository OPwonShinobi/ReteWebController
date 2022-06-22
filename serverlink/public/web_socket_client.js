// Create WebSocket connection. Note this runs in App, but is separate from main server
// Connection closes by itself on page refresh. No need to clean up
export class WebSockType {
  static CLOSE = "EOT";
  static BROADCAST = "BROADCAST";
  static HTTP = "HTTP";
  static INVALID = "ERR";
  static RENAME = "RENAME";
}
export class WebSockFields {
  static MESSAGE_TYPE = "TYPE";
  static NEW_NAME = "NEW_NAME";
  static OLD_NAME = "OLD_NAME";
  static DEST = "DEST";
  static PAYLOAD = "PAYLOAD";
  static METHOD = "METHOD";
}
export class WebSockUtils {
  static getWsKey(jsonObj) {
    let res = jsonObj[WebSockFields.MESSAGE_TYPE];
    switch(res) {
      case WebSockType.CLOSE:
      case WebSockType.BROADCAST:
      case WebSockType.HTTP:
      case WebSockType.RENAME:
        break;
      default:
        res = WebSockType.INVALID;
    }
    return res;
  }
  static getWsPayload(jsonObj) {
    return jsonObj[WebSockFields.PAYLOAD];
  }
}