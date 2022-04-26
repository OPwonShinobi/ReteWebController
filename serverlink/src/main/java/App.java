import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;

import fi.iki.elonen.NanoHTTPD;

public class App extends NanoHTTPD {
  private static final int PORT = 8080;
  private static final String HOMEPAGE = "../dist/index.html";
  private static String homepageContents;

  public static void parseHomepage() throws IOException {
    byte[] encoded = Files.readAllBytes(Paths.get(HOMEPAGE));
    homepageContents = new String(encoded);
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
      parseHomepage();
      new App(port);
    } catch (IOException ioe) {
      System.err.println("Couldn't start server:\n" + ioe);
    }
  }

  @Override
  public Response serve(IHTTPSession session) {
    //session.getParms()
    return newFixedLengthResponse(homepageContents);
  }
}