// Create WebSocket connection. Note this runs in App, but is separate from main server
// Connection closes by itself on page refresh. No need to clean up
export class WebSockType {
  static BROADCAST = "BROADCAST";
  static HTTP = "HTTP";
  static INVALID = "ERR";
  static RENAME = "RENAME";
}
export class WebSockFields {
  static TYPE = "TYPE";
  static NEW_NAME = "NEW_NAME";
  static OLD_NAME = "OLD_NAME";
  static PAYLOAD = "PAYLOAD";
  static ENDPOINT = "ENDPOINT";
}
export class WebSockUtils {
  static getWsKey(jsonObj) {
    let res = jsonObj[WebSockFields.TYPE];
    switch(res) {
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