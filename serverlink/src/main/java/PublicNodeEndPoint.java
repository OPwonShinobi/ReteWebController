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
      if (!session.getParameters().isEmpty()) {
        JSONObject req = new JSONObject();
        req.put(WebSocketUtils.PAYLOAD, params.get("postData"));
        req.put(WebSocketUtils.TYPE, WebSocketUtils.Type.BROADCAST.toString());
        req.put(WebSocketUtils.NAME, session.getParameters().get(WebSocketUtils.NAME).get(0));
        _wsServer.broadcast(req.toString());
        return RouterNanoHTTPD.newFixedLengthResponse(NanoHTTPD.Response.Status.OK, this.getMimeType(), "Request transferred to websocket");
      }
      return RouterNanoHTTPD.newFixedLengthResponse(NanoHTTPD.Response.Status.BAD_REQUEST, this.getMimeType(), "Request missing name param");
    } catch (IOException | NanoHTTPD.ResponseException e) {
      e.printStackTrace();
      return NanoHTTPD.newFixedLengthResponse(NanoHTTPD.Response.Status.BAD_REQUEST, this.getMimeType(), "Parsing POST body failed");
    }
  }
}
