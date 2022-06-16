import java.net.InetSocketAddress;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

public class SimpleWebSocketServer extends WebSocketServer {

  public SimpleWebSocketServer(InetSocketAddress address) {
    super(address);
    System.out.println(String.format("\nStarting websocket server at %s:%d\n", address.getHostName(), address.getPort()));
  }

  @Override
  public void onOpen(WebSocket conn, ClientHandshake handshake) {
    conn.send("Welcome to the server!"); //This method sends a message to the new client
    System.out.println("new connection to " + conn.getRemoteSocketAddress());
  }

  @Override
  public void onClose(WebSocket conn, int code, String reason, boolean remote) {
    System.out.println(String.format("Conn closed %s. Exit code %d. More info [%s]", conn.getRemoteSocketAddress(), code, reason));
  }

  @Override
  public void onMessage(WebSocket conn, String message) {
    System.out.println("received message from "	+ conn.getRemoteSocketAddress() + ": " + message);
    //TODO extract URL info from either node or configs
    //TODO move PrivateNodeEndpoint http calls here
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