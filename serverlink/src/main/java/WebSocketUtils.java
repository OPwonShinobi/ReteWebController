import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

public class WebSocketUtils {
  public static final String TYPE = "type";
  public static final String STATUS = "status";
  public static final String NAME = "name";

  public static final String PAYLOAD = "payload";
  public static final String RAW = "raw";
  public static final String ENDPOINT = "endpoint";
  public static final String DEST = "dest";
  public static final String METHOD = "method";
  public static final String POST = "post";

  public enum Type {
    BROADCAST("broadcast"),
    HTTP("http"),
    QUEUE("queue"),
    INVALID("invalid");
    private String value;
    Type(String value) {
      this.value = value;
    }
    private static Map<String, Type> valueMap = Arrays
        .stream(Type.values())
        .collect(Collectors.toMap(Type::toString, Function.identity()));

    public static Type parse(String value) {
      return valueMap.getOrDefault(value, INVALID);
    }
    @Override
    public String toString() {
      return this.value;
    }
  }
}
