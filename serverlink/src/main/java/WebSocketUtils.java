import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

public class WebSocketUtils {
  public static final String TYPE = "TYPE";
  public static final String NEW_NAME = "NEW_NAME";
  public static final String OLD_NAME = "OLD_NAME";
  public static final String PAYLOAD = "PAYLOAD";
  public static final String ENDPOINT = "ENDPOINT";
  public static final String URL = "url";
  public static final String METHOD = "METHOD";
  public static final String $PAYLOAD = "$PAYLOAD";

  public enum Type {
    BROADCAST("BROADCAST"),
    HTTP("HTTP"),
    INVALID("ERR"),
    RENAME("RENAME");
    private String name;
    Type(String name) {
      this.name = name;
    }
    private static Map<String, Type> nameMap = Arrays
        .stream(Type.values())
        .collect(Collectors.toMap(Type::name, Function.identity()));

    public static Type parse(String value) {
      return nameMap.getOrDefault(value, INVALID);
    }
    @Override
    public String toString() {
      return this.name;
    }
  }
}
