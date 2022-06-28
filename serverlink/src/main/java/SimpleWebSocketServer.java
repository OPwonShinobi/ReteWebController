import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import org.json.JSONObject;

public class SimpleWebSocketServer extends WebSocketServer {
  private Map<String, WebSocket> connLookup = new HashMap<>();
  private ConfigurationHandler configHandler;

  public SimpleWebSocketServer(InetSocketAddress address, ConfigurationHandler configHandler) {
    super(address);
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
    JSONObject rspObj = new JSONObject();
    rspObj.append(WebSocketUtils.TYPE, msgType);

    if (msgType == WebSocketUtils.Type.RENAME) {
      changeConnName(jsonObj, conn);
    }
    else if (msgType == WebSocketUtils.Type.HTTP) {
      rspObj.put(WebSocketUtils.PAYLOAD, sendHttpRequestWithResponse(jsonObj));
      conn.send(rspObj.toString());
    }
  }
  private void changeConnName(JSONObject jsonObj, WebSocket conn) {
    connLookup.remove(jsonObj.getString(WebSocketUtils.OLD_NAME));
    connLookup.put(jsonObj.getString(WebSocketUtils.NEW_NAME), conn);
  }
  private String sendHttpRequestWithResponse(JSONObject jsonObj) {
    String payload = jsonObj.getString(WebSocketUtils.PAYLOAD);
    String endPointName = jsonObj.getString(WebSocketUtils.ENDPOINT);
    JSONObject endPoint = configHandler.getEndPoint(endPointName);

    String dst = endPoint.getString("dest");
    String method = endPoint.getString("method");
    JSONObject headers = endPoint.getJSONObject("headers");
    try {
      URL url = new URL(dst);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod(method);
      for (String field : headers.keySet()) {
        conn.setRequestProperty(field, headers.getString(field));
      }

      //request
      DataOutputStream wr = new DataOutputStream(conn.getOutputStream());
      wr.writeBytes(payload);
      wr.close();

      //response
      BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
      StringBuilder response = new StringBuilder();
      String inputLine;
      while ((inputLine = in.readLine()) != null) {
        response.append(inputLine);
        response.append('\r');
      }
      in.close();
      return response.toString();
    } catch (IOException e) {
      e.printStackTrace();
      return null;
    }
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