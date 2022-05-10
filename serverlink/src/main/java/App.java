import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;

import fi.iki.elonen.NanoHTTPD;

public class App extends NanoHTTPD {
  private static final int PORT = 8080;
  private static final String DIST = "./dist";
  private static final String HOMEPAGE = "index.html";
  private static Map<String, String> resources;

  public static void parseResources() throws IOException {
    resources = new HashMap<>();
    for (File file : new File(DIST).listFiles()) {
      byte[] encoded = Files.readAllBytes(file.toPath());
      String savedName = file.getName().equals(HOMEPAGE) ? HOMEPAGE : file.getName();
      resources.put(savedName, new String(encoded));
    }
  }

  public App(final int port) throws IOException {
    super(port);
    start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
    System.out.println(String.format("\nRunning! Point your browsers to http://localhost:%d/ \n", port));
  }

  public static void main(String[] args) {
    int port = PORT;
    if (args.length > 1) {
      port = Integer.parseInt(args[1]);
    }
    try {
      parseResources();
      new App(port);
    } catch (IOException ioe) {
      System.err.println("Couldn't start server:\n" + ioe);
    }
  }

  @Override
  public Response serve(IHTTPSession session) {
    String resource = session.getUri().substring(1); //trim leading "/"
    if (resource.isEmpty()) {
      return newFixedLengthResponse(resources.get(HOMEPAGE));
    }
    if (session.getMethod() == Method.GET) {
      if (resources.get(resource) != null) {
        return newFixedLengthResponse(resources.get(resource));
      }
      return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "No GET resource: " + session.getUri());
    }
    return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "No resource: " + session.getUri());
  }
}