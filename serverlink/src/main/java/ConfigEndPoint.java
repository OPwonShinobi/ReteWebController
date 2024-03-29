import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.router.RouterNanoHTTPD;

import java.util.Map;

public class ConfigEndPoint extends RouterNanoHTTPD.GeneralHandler{
  private static ConfigurationHandler _configHandler;
  public static void setConfigHandler(ConfigurationHandler configHandler) {
    _configHandler = configHandler;
  }

  @Override
  public NanoHTTPD.Response get(RouterNanoHTTPD.UriResource uriResource, Map<String, String> urlParams, NanoHTTPD.IHTTPSession session) {
    if (!session.getParameters().isEmpty()) {
      String configType = session.getParameters().get("type").get(0);
      String rsp = null;
      if (configType.equals("endpoints")) {
        rsp = _configHandler.getEndPoints().toString();
      }
      if (configType.equals("endpoint")) {
        rsp = _configHandler.getEndPoint(session.getParameters().get("name").get(0)).toString();
      }
      if (configType.equals("setting")) {
        rsp = _configHandler.getSetting(session.getParameters().get("name").get(0));
      }
      return RouterNanoHTTPD.newFixedLengthResponse(rsp);
    }
    return RouterNanoHTTPD.newFixedLengthResponse("Need to specify a config");
  }
}
