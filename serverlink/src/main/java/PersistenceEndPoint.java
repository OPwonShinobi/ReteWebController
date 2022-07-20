import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.router.RouterNanoHTTPD;
import org.json.JSONArray;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Map;

public class PersistenceEndPoint extends RouterNanoHTTPD.GeneralHandler {

	@Override
	public NanoHTTPD.Response get(RouterNanoHTTPD.UriResource uriResource, Map<String, String> urlParams, NanoHTTPD.IHTTPSession session) {
		if (!session.getParameters().isEmpty()) {
			String save = session.getParameters().get("name").get(0);
			return RouterNanoHTTPD.newFixedLengthResponse(getSave(save));
		}
		return RouterNanoHTTPD.newFixedLengthResponse(getAllSaves());
	}
  private String getSave(String name) {
    //user selects from list returned from getAllSaves. File will exist
    try {
      return new String(Files.readAllBytes(Paths.get("./saves/"+name)));
    } catch (java.io.IOException e) {
      e.printStackTrace();
      throw new RuntimeException("Shouldn't reach here");
    }
  }
	private String getAllSaves() {
		JSONArray saves = new JSONArray();
		Arrays.stream(new File("./saves").listFiles()).forEach(file ->
			saves.put(file.getName())
		);
		return saves.toString();
	}
	@Override
	public NanoHTTPD.Response post(RouterNanoHTTPD.UriResource uriResource, Map<String, String> urlParams, NanoHTTPD.IHTTPSession session) {
    String name = session.getParameters().get("name").get(0);
    String value = session.getParameters().get("value").get(0);
    save(name, value);
    return super.post(uriResource, urlParams, session);
	}
  private void save(String name, String value) {
    try (PrintWriter writer = new PrintWriter(new File("./saves/"+name))) {
      writer.print(value);
    } catch (FileNotFoundException e) {
      e.printStackTrace();
      throw new RuntimeException("Shouldn't reach here either");
    }
  }

  @Override
  public NanoHTTPD.Response delete(RouterNanoHTTPD.UriResource uriResource, Map<String, String> urlParams, NanoHTTPD.IHTTPSession session) {
    String name = session.getParameters().get("name").get(0);
    new File("./saves/"+name).delete();
    return super.delete(uriResource, urlParams, session);
  }
}