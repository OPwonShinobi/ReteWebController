import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.router.RouterNanoHTTPD;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public class NodeEndPoint extends RouterNanoHTTPD.GeneralHandler  {

  @Override
  public NanoHTTPD.Response get(
    RouterNanoHTTPD.UriResource uriResource, Map<String, String> urlParams, NanoHTTPD.IHTTPSession session) {
    return RouterNanoHTTPD.newFixedLengthResponse(session.getParameters().get("dat").get(0));
  }
  @Override
  public NanoHTTPD.Response post(
    RouterNanoHTTPD.UriResource uriResource, Map<String, String> urlParams, NanoHTTPD.IHTTPSession session) {
    Map<String,String> params = new HashMap<>();
    try {
      session.parseBody(params);
      return RouterNanoHTTPD.newFixedLengthResponse(params.get("postData"));//postData is nanohttpd hardcoded value
    } catch (IOException | NanoHTTPD.ResponseException e) {
      e.printStackTrace();
      return NanoHTTPD.newFixedLengthResponse(NanoHTTPD.Response.Status.BAD_REQUEST, this.getMimeType(), "Parsing POST body failed");
    }
  }
}
