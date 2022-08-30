import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import kong.unirest.Callback;
import kong.unirest.HttpRequest;
import kong.unirest.HttpRequestWithBody;
import kong.unirest.HttpResponse;
import kong.unirest.JsonNode;
import kong.unirest.MultipartBody;
import kong.unirest.Unirest;
import kong.unirest.UnirestException;
import org.apache.commons.codec.binary.Base64;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import org.json.JSONArray;
import org.json.JSONObject;

public class SimpleWebSocketServer extends WebSocketServer {
  private ConfigurationHandler configHandler;

  public SimpleWebSocketServer(InetSocketAddress address, ConfigurationHandler configHandler) {
    super(address);
    Unirest.primaryInstance().config().connectTimeout(Integer.parseInt(configHandler.getSetting("ws_connect_timeout")));
    Unirest.primaryInstance().config().socketTimeout(Integer.parseInt(configHandler.getSetting("ws_socket_timeout")));
    System.out.println(String.format("\nStarting websocket server at %s:%d\n", address.getHostName(), address.getPort()));
    this.configHandler = configHandler;
  }

  @Override
  public void onError(WebSocket conn, Exception ex) {
    System.err.println("an error occurred on connection " + conn.getRemoteSocketAddress()  + ":" + ex);
  }
  @Override
  public void onStart() {
    System.out.println("Websocket server is up");
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
    //ignore, currently only HTTP messages in use
    WebSocketUtils.Type msgType = WebSocketUtils.Type.parse(jsonObj.getString(WebSocketUtils.TYPE));
    sendJsonHttpRequest(jsonObj, conn);
  }
  private HttpRequest handleHeaders(HttpRequest req, JSONObject endPoint) {
    JSONObject headers = endPoint.has("headers") ? endPoint.getJSONObject("headers") : new JSONObject();
    for (String key : headers.keySet()) {
      String val = headers.getString(key);
      if (key.equalsIgnoreCase("Content-type") && val.equalsIgnoreCase("multipart/form-data")) {
        continue;//unirest bug, multipart content-type is supported but cannot be specified
      }
      req = req.header(key, val);
    }
    return req;
  }
  //if endpoint needs it, route params are mandatory
  private HttpRequest handleRouteParams(HttpRequest req, JSONObject endPoint, JSONObject webSockMsg) {
    String dest = endPoint.getString("dest");
    if (Pattern.compile("\\{\\w+}").matcher(dest).find()) { //if url contains {..}
      JSONObject payloadJson = webSockMsg.getJSONObject(WebSocketUtils.PAYLOAD);
      //extract all words in braces, eg localhost/{user}/{order} returns [user, order]
      Matcher paramExtractor = Pattern.compile("(?<=\\{)\\w+(?=})").matcher(dest);
      while (paramExtractor.find()) {
        String paramName = paramExtractor.group();
        req = req.routeParam(paramName, payloadJson.get(paramName).toString());
      }
    }
    return req;
  }
  //every query param is optional
  private HttpRequest handleQueryParams(HttpRequest req, JSONObject endPoint, JSONObject webSockMsg) {
    if (endPoint.has("queries") && webSockMsg.has(WebSocketUtils.PAYLOAD)) {
      JSONObject payloadJson = webSockMsg.getJSONObject(WebSocketUtils.PAYLOAD);
      JSONArray queries = endPoint.getJSONArray("queries");
      for (int i = 0; i < queries.length(); i++) {
        String param = queries.getString(i);
        if (payloadJson.has(param)) {
          req = req.queryString(param, payloadJson.get(param).toString());
        }
      }
    }
    return req;
  }
  private HttpRequest handleBody(HttpRequest req, JSONObject endPoint, JSONObject webSockMsg) {
    if (endPoint.has("body")) {
      JSONObject body = endPoint.getJSONObject("body");
      //if has body, will have type
      String bodyType = body.getString("type");
      switch (bodyType) {
        //postman has more, but currently only support these 2
        case "raw":
          String rawPayload = webSockMsg.getString(WebSocketUtils.PAYLOAD);
          req = ((HttpRequestWithBody)req).body(rawPayload);
          break;
        case "form-data":
          JSONObject formDataPayload = webSockMsg.getJSONObject(WebSocketUtils.PAYLOAD);
          JSONArray fields = body.getJSONArray("fields");
          req = handleBodyFields(req, formDataPayload, fields);
          break;
      }
    }
    return req;
  }

  private HttpRequest handleBodyFields(HttpRequest req, JSONObject payload, JSONArray fields) {
    for (int i = 0 ; i < fields.length(); i++) {
      JSONObject field = fields.getJSONObject(i);
      String name = field.getString("name");
      String type = field.has("type") ? field.getString("type"):"text";
      if (!payload.has(name)) {
        continue;
      }
      //postman only lists these 2
      if ("file".equals(type)) {
        InputStream fileBytes = base64ToInputStream(payload.getString(name));
        if (req instanceof HttpRequestWithBody) {
          ((HttpRequestWithBody)req).noCharset();
          req = ((HttpRequestWithBody)req).field(name, fileBytes, "temp");
        }
        else if (req instanceof MultipartBody) {
          ((MultipartBody)req).charset(null);
          req = ((MultipartBody)req).field(name, fileBytes, "temp");
        }
      }
      else if ("text".equals(type)) {
        //cannot use getString since string can be int/boolean
        String fieldData =  payload.get(name).toString();
        if (req instanceof HttpRequestWithBody)
          req = ((HttpRequestWithBody)req).field(name, fieldData);
        else if (req instanceof MultipartBody)
          req = ((MultipartBody)req).field(name, fieldData);
      }
      else {
        throw new RuntimeException("Unsupported field type "+ type);
      }
    }
    return req;
  }
  private InputStream base64ToInputStream(String base64DataUrl) {
    byte[] data = Base64.decodeBase64(base64DataUrl);
    return new ByteArrayInputStream(data);
  }
  private void sendJsonHttpRequest(JSONObject webSockMsg, WebSocket conn) {
    //for now, specify selected endpoint in data from front end
    JSONObject endPoint = webSockMsg.getJSONObject(WebSocketUtils.ENDPOINT);

    String dest = endPoint.getString(WebSocketUtils.DEST);
    String method = endPoint.getString(WebSocketUtils.METHOD).toLowerCase();

    HttpRequest req;
    if (method.equals(WebSocketUtils.POST)) {
      req = Unirest.post(dest);
      req = handleBody(req, endPoint, webSockMsg);//only post has body
    } else {
      req = Unirest.get(dest);
    }
    req = handleHeaders(req, endPoint);
    req = handleRouteParams(req, endPoint, webSockMsg);
    req = handleQueryParams(req, endPoint, webSockMsg);
    req.asJsonAsync(new Callback<JsonNode>() {
      @Override
      public void failed(UnirestException e) {
        this.sendToWebSock(-1, e.getMessage());
      }
      @Override
      public void completed(HttpResponse<JsonNode> rsp) {
        if (rsp.getStatus() == 200) {
          this.sendToWebSock(rsp.getStatus(), rsp.getBody() == null ? "" : rsp.getBody().toString());
        } else {
          this.sendToWebSock(rsp.getStatus(), rsp.mapError(String.class));
        }
      }
      private void sendToWebSock(int status, String msg) {
        JSONObject rspObj = new JSONObject();
        rspObj.put(WebSocketUtils.TYPE, WebSocketUtils.Type.HTTP.toString());
        rspObj.put(WebSocketUtils.STATUS, status);
        rspObj.put(WebSocketUtils.PAYLOAD, msg);
        conn.send(rspObj.toString());
      }
    });
  }
}