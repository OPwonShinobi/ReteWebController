import java.io.File;
import java.net.InetSocketAddress;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import kong.unirest.Callback;
import kong.unirest.HttpRequest;
import kong.unirest.HttpResponse;
import kong.unirest.JsonNode;
import kong.unirest.Unirest;
import kong.unirest.UnirestException;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import org.json.JSONObject;

public class SimpleWebSocketServer extends WebSocketServer {
  private Map<String, WebSocket> connLookup = new HashMap<>();
  private ConfigurationHandler configHandler;

  public SimpleWebSocketServer(InetSocketAddress address, ConfigurationHandler configHandler) {
    super(address);
    //might move this to configs at some point
    Unirest.primaryInstance().config().connectTimeout(1000);
    Unirest.primaryInstance().config().socketTimeout(1000);
    System.out.println(String.format("\nStarting websocket server at %s:%d\n", address.getHostName(), address.getPort()));
    this.configHandler = configHandler;
  }

  public void broadcastByConnName(JSONObject req, String name) {
    if (!connLookup.containsKey(name)) {
      throw new RuntimeException("Named connection not found: " + name);
    }
    connLookup.get(name).send(req.toString());
  }

  @Override
  public void onOpen(WebSocket conn, ClientHandshake handshake) {
    System.out.println("new connection to " + conn.getRemoteSocketAddress());
  }

  @Override
  public void onClose(WebSocket conn, int code, String reason, boolean remote) {
    System.out.println(String.format("Conn closed %s. Exit code %d. More info [%s]", conn.getRemoteSocketAddress(), code, reason));
  }

  @Override
  public void onMessage(WebSocket conn, String message) {
    System.out.println("received message from "	+ conn.getRemoteSocketAddress() + ": " + message);
    JSONObject jsonObj = new JSONObject(message);
    WebSocketUtils.Type msgType = WebSocketUtils.Type.parse(jsonObj.getString(WebSocketUtils.TYPE));
    if (msgType == WebSocketUtils.Type.RENAME) {
      changeConnName(jsonObj, conn);
    }
    else if (msgType == WebSocketUtils.Type.HTTP) {
      sendJsonHttpRequest(jsonObj, conn);
    }
  }
  private void changeConnName(JSONObject jsonObj, WebSocket conn) {
    connLookup.remove(jsonObj.getString(WebSocketUtils.OLD_NAME));
    connLookup.put(jsonObj.getString(WebSocketUtils.NEW_NAME), conn);
  }
  private HttpRequest handleHeaders(HttpRequest req, JSONObject endPoint) {
    JSONObject headers = endPoint.has("headers") ? endPoint.getJSONObject("headers") : new JSONObject();
    for (String key : headers.keySet()) {
      req = req.header(key, headers.getString(key));
    }
    return req;
  }
  private HttpRequest handleRouteParams(HttpRequest req, JSONObject endPoint, JSONObject dataObj) {
    String dest = endPoint.getString("dest");
    if (Pattern.compile("\\{\\w+}").matcher(dest).find()) { //if url contains {..}
      //extract all words in braces, eg localhost/{user}/{order} returns [user, order]
      Matcher paramExtractor = Pattern.compile("(?<=\\{)\\w+(?=})").matcher("string to search from here");
      JSONObject payloadJson = dataObj.getJSONObject(WebSocketUtils.PAYLOAD);
      while (paramExtractor.find()) {
        String paramName = paramExtractor.group();
        req = req.routeParam(paramName, payloadJson.getString(paramName));
      }
    }
    return req;
  }
  private HttpRequest handleBody(HttpRequest req, JSONObject endPoint, JSONObject dataObj) {
    return req;
  }
  private void sendJsonHttpRequest(JSONObject dataObj, WebSocket conn) {
    String endPointName = dataObj.getString(WebSocketUtils.ENDPOINT);
    JSONObject endPoint = configHandler.getEndPoint(endPointName);
    String dest = endPoint.getString("dest");
    String method = endPoint.getString("method").toUpperCase();

    HttpRequest req;
    if (method.equals("POST")) {
      req = Unirest.post(dest)
        .header("Accept", "application/json")
        .field("file", new File("/C:/Users/lrink/AppData/Local/Postman/app-9.22.2/chrome_200_percent.pak"))
        .field("modelId", "8003944");
    } else {
      req = Unirest.get(dest);
    }
    req = handleHeaders(req, endPoint);
    req = handleRouteParams(req, endPoint, dataObj);


    req.asJsonAsync(new Callback<JsonNode>() {
      @Override
      public void failed(UnirestException e) {
        this.send(e.getMessage());
      }
      @Override
      public void completed(HttpResponse<JsonNode> rsp) {
        this.send(rsp.getBody().toString());
      }
      private void send(String msg) {
        JSONObject rspObj = new JSONObject();
        rspObj.put(WebSocketUtils.TYPE, WebSocketUtils.Type.HTTP);
        rspObj.put(WebSocketUtils.PAYLOAD, msg);
        conn.send(rspObj.toString());
      }
    });
  }

  @Override
  public void onError(WebSocket conn, Exception ex) {
    System.err.println("an error occurred on connection " + conn.getRemoteSocketAddress()  + ":" + ex);
  }

  @Override
  public void onStart() {
    System.out.println("Websocket server is up");
  }
}