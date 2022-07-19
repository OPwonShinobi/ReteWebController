import java.io.IOException;
import java.net.InetSocketAddress;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.router.RouterNanoHTTPD;
import org.java_websocket.server.WebSocketServer;

public class App extends RouterNanoHTTPD {

  @Override
  public void addMappings() {
    addRoute("/", Homepage.class);
    addRoute("/bundle.js", Homepage.class);
    addRoute("/favicon.png", Homepage.class);
    addRoute("/input", PublicNodeEndPoint.class);
    addRoute("/config", ConfigEndPoint.class);
    addRoute("/persist", PersistenceEndPoint.class);
  }

  public App(final int port) throws IOException {
    super(port);
    addMappings();
    start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
    System.out.println(String.format("\nRunning! Point your browsers to http://localhost:%d/ \n", port));
  }

  public static void main(String[] args) throws IOException {
    ConfigurationHandler configHandler = new ConfigurationHandler();
    new App(configHandler.getServerPort());
    InetSocketAddress wsSocketAddr = new InetSocketAddress("localhost", configHandler.getWebSockPort());
    WebSocketServer server = new SimpleWebSocketServer(wsSocketAddr, configHandler);
    PublicNodeEndPoint.setWsServer(server);
    ConfigEndPoint.setConfigHandler(configHandler);

    server.run();
  }

}