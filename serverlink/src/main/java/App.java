import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URISyntaxException;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.router.RouterNanoHTTPD;
import org.java_websocket.server.WebSocketServer;

public class App extends RouterNanoHTTPD {
  private static final int PORT = 8080;

  @Override
  public void addMappings() {
    addRoute("/", Homepage.class);
    addRoute("/bundle.js", Homepage.class);
    addRoute("/favicon.png", Homepage.class);
    addRoute("/input", PublicNodeEndPoint.class);
  }

  public App(final int port) throws IOException {
    super(port);
    addMappings();
    start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
    System.out.println(String.format("\nRunning! Point your browsers to http://localhost:%d/ \n", port));
  }

  public static void main(String[] args) {
    int port = PORT;
    if (args.length > 1) {
      port = Integer.parseInt(args[1]);
    }
    int wsPort = port+1;
    try {
      new App(port);
      //use 8081 by default
      InetSocketAddress wsSocketAddr = new InetSocketAddress("localhost", wsPort);
      WebSocketServer server = new SimpleWebSocketServer(wsSocketAddr);
      //SimpleWebSocketClient client = new SimpleWebSocketClient(new URI("ws://localhost:"+wsPort) );
      PublicNodeEndPoint.setWsServer(server);
      server.run();
      //client.connect();
    } catch (IOException ioe) {
      System.err.println("Couldn't start server:\n" + ioe);
    }
  }

}