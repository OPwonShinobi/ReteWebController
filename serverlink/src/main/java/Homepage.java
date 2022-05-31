import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.router.RouterNanoHTTPD;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;

public class Homepage extends RouterNanoHTTPD.DefaultHandler {
  private final String DIST = "./dist";
  private final String HOMEPAGE = "index.html";
  private Map<String, String> resources;

  public Homepage() throws IOException {
    resources = new HashMap<>();
    for (File file : new File(DIST).listFiles()) {
      byte[] encoded = Files.readAllBytes(file.toPath());
      String savedName = file.getName().equals(HOMEPAGE) ? HOMEPAGE : file.getName();
      resources.put(savedName, new String(encoded));
    }
  }

  public NanoHTTPD.Response get(RouterNanoHTTPD.UriResource uriResource, Map<String, String> urlParams, NanoHTTPD.IHTTPSession session) {
    NanoHTTPD.newFixedLengthResponse(this.getStatus(), this.getMimeType(), this.getText());
    String resource = session.getUri().substring(1); //trim leading "/"
    if (resource.isEmpty()) {
      return NanoHTTPD.newFixedLengthResponse(resources.get(HOMEPAGE));
    }
    if (resources.get(resource) != null) {
      return NanoHTTPD.newFixedLengthResponse(resources.get(resource));
    }
    return NanoHTTPD.newFixedLengthResponse(this.getStatus(), this.getMimeType(), this.getText());
  }

  @Override
  public String getText() {
    return "No resource found";
  }

  @Override
  public String getMimeType() {
    return fi.iki.elonen.NanoHTTPD.MIME_PLAINTEXT;
  }

  @Override
  public NanoHTTPD.Response.IStatus getStatus() {
    return NanoHTTPD.Response.Status.NOT_FOUND;
  }
}
