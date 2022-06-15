import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.router.RouterNanoHTTPD;

import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

public class PrivateNodeEndPoint extends RouterNanoHTTPD.GeneralHandler  {
  private enum HttpMethod {
    POST, GET
  }

  @Override
  public NanoHTTPD.Response get(
    RouterNanoHTTPD.UriResource uriResource, Map<String, String> urlParams, NanoHTTPD.IHTTPSession session) {
    // send HTTP GET request to remote endpoint, then send the response back to JS
    String url = session.getParameters().get("url").get(0);
    String data = session.getParameters().get("dat").get(0);
    String rsp = sendReq(HttpMethod.GET, url, data);
    return RouterNanoHTTPD.newFixedLengthResponse(rsp);
  }
  @Override
  public NanoHTTPD.Response post(
    RouterNanoHTTPD.UriResource uriResource, Map<String, String> urlParams, NanoHTTPD.IHTTPSession session) {
    Map<String,String> params = new HashMap<>();
    try {
      session.parseBody(params);
      JSONObject reqJson = (JSONObject) new JSONParser().parse(params.get("postData")); //postData is hardcoded nanohttp keyword
      String url = (String) reqJson.get("url");
      String data = (String) reqJson.get("dat");
      String rsp = sendReq(HttpMethod.POST, url, data);
      return RouterNanoHTTPD.newFixedLengthResponse(rsp);
    } catch (IOException | NanoHTTPD.ResponseException | ParseException e) {
      e.printStackTrace();
      return NanoHTTPD.newFixedLengthResponse(NanoHTTPD.Response.Status.BAD_REQUEST, this.getMimeType(), "Parsing POST body failed");
    }
  }
  private String sendReq(HttpMethod method, String dstUrl, String urlParameters) {
    try {
      URL url = new URL(dstUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod(method.name());

      //Send request
      DataOutputStream wr = new DataOutputStream (
        conn.getOutputStream());
      wr.writeBytes(urlParameters);
      wr.close();

      //Get Response
      BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
      StringBuilder response = new StringBuilder();
      String inputLine;
      while ((inputLine = in.readLine()) != null) {
        response.append(inputLine);
        response.append('\r');
      }
      in.close();
      return response.toString();
    } catch (Exception e) {
      e.printStackTrace();
      return null;
    }
  }
  //unused. May need to use for post
  private String sendReq2(HttpMethod method, String dstUrl, String urlParameters) {
    HttpURLConnection connection = null;

    try {
      //Create connection
      URL url = new URL(dstUrl);
      connection = (HttpURLConnection) url.openConnection();
      connection.setRequestMethod(method.name());
      connection.setRequestProperty("Content-Type","application/x-www-form-urlencoded");

      connection.setUseCaches(false);
      connection.setDoOutput(true);

      //Send request
      DataOutputStream wr = new DataOutputStream (
        connection.getOutputStream());
      wr.writeBytes(urlParameters);
      wr.close();

      //Get Response
      InputStream is = connection.getInputStream();
      BufferedReader rd = new BufferedReader(new InputStreamReader(is));
      StringBuilder response = new StringBuilder(); // or StringBuffer if Java version 5+
      String line;
      while ((line = rd.readLine()) != null) {
        response.append(line);
        response.append('\r');
      }
      rd.close();
      return response.toString();
    } catch (Exception e) {
      e.printStackTrace();
      return null;
    } finally {
      if (connection != null) {
        connection.disconnect();
      }
    }
  }

}
