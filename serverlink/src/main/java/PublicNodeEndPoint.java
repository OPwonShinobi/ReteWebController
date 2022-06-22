import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.router.RouterNanoHTTPD;
import org.java_websocket.server.WebSocketServer;
import org.json.JSONObject;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public class PublicNodeEndPoint extends RouterNanoHTTPD.GeneralHandler  {
  /* using this for now, unless we decide to convert handlers to injected beans */
  private static WebSocketServer _wsServer;
  public static void setWsServer(WebSocketServer wsServer) {
    _wsServer = wsServer;
  }

  @Override
  //Only POST endpoint. No public GET endpoint, because data in rete flows 1 way. To return data to caller, app needs to go through PrivateNodeEndpoint
  public NanoHTTPD.Response post(
    RouterNanoHTTPD.UriResource uriResource, Map<String, String> urlParams, NanoHTTPD.IHTTPSession session) {
    Map<String,String> params = new HashMap<>();
    try {
      session.parseBody(params);
      //TODO, wsServer supports bytes. Figure out how to get queue/byte data into this call, since post is always string
      JSONObject req = new JSONObject();
      req.put(WebSocketUtils.PAYLOAD, params.get("postData"));
      if (session.getParameters().isEmpty()) {
        req.put(WebSocketUtils.MESSAGE_TYPE, WebSocketUtils.Type.BROADCAST);
        _wsServer.broadcast(req.toString());
      } else {
        req.put(WebSocketUtils.MESSAGE_TYPE, WebSocketUtils.Type.HTTP);
        String name = session.getParameters().get("name").get(0);
        ((SimpleWebSocketServer)_wsServer).broadcastByConnName(req, name);
      }
      return RouterNanoHTTPD.newFixedLengthResponse(NanoHTTPD.Response.Status.OK, this.getMimeType(), "Request transferred to websocket");
    } catch (IOException | NanoHTTPD.ResponseException e) {
      e.printStackTrace();
      return NanoHTTPD.newFixedLengthResponse(NanoHTTPD.Response.Status.BAD_REQUEST, this.getMimeType(), "Parsing POST body failed");
    }
  }
}
