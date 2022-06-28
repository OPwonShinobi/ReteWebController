import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.List;

public class ConfigurationHandler {

    private JSONObject cachedConfigs;
    public ConfigurationHandler() throws FileNotFoundException {
      File configFile = new File("./config/config.json");
      InputStream is = new FileInputStream(configFile);
      JSONTokener tokener = new JSONTokener(is);
      cachedConfigs = new JSONObject(tokener);
    }
    public int getServerPort() {
      return cachedConfigs.getInt("server_port");
    }
    public int getWebSockPort() {
      return cachedConfigs.getInt("ws_port");
    }
    public JSONObject getEndPoint(String name) {
      JSONObject allEndPoints = cachedConfigs.getJSONObject("endpoints");
      return allEndPoints.has(name) ? allEndPoints.getJSONObject(name) : new JSONObject();
    }
    public JSONArray getEndPoints() {
      JSONObject allEndPoints = cachedConfigs.getJSONObject("endpoints");
      return new JSONArray(allEndPoints.keySet());
    }
    public String getSetting(String name) {
      return cachedConfigs.has(name) ? cachedConfigs.get(name).toString() : null;
    }
    public String getAllConfigFiles() {
      JSONObject rspObj = new JSONObject();
      JSONArray configFileNames = new JSONArray();
      Arrays.stream(new File("./config").listFiles()).forEach(file ->
        configFileNames.put(file.getName())
      );
      rspObj.append("FILES", configFileNames);
      return rspObj.toString();
    }
}
