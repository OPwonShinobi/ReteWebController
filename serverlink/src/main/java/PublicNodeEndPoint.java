import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.router.RouterNanoHTTPD;
import org.java_websocket.client.WebSocketClient;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public class PublicNodeEndPoint extends RouterNanoHTTPD.GeneralHandler  {
  /* using this for now, unless we decide to convert handlers to injected beans */
  private static WebSocketClient _client;
  public static void setWsClient(WebSocketClient client) {
    _client = client;
  }

  @Override
  public NanoHTTPD.Response post(
    RouterNanoHTTPD.UriResource uriResource, Map<String, String> urlParams, NanoHTTPD.IHTTPSession session) {
    Map<String,String> params = new HashMap<>();
    try {
      session.parseBody(params);
      _client.send(params.get("postData"));
      return RouterNanoHTTPD.newFixedLengthResponse(NanoHTTPD.Response.Status.OK, this.getMimeType(), "Request transferred to websocket");
    } catch (IOException | NanoHTTPD.ResponseException e) {
      e.printStackTrace();
      return NanoHTTPD.newFixedLengthResponse(NanoHTTPD.Response.Status.BAD_REQUEST, this.getMimeType(), "Parsing POST body failed");
    }
  }
}
