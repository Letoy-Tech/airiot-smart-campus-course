import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.letoy.main.campus.airiot.AiriotClient;
import com.letoy.main.campus.airiot.AiriotException;
import com.letoy.main.campus.airiot.AiriotProperties;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;

/** Read-only live verification. Never prints credentials, URLs, tokens or raw user responses. */
public class VerifyAiriotReads {
    static final ObjectMapper JSON = new ObjectMapper();
    static final Map<String,String> PREFIXES = new LinkedHashMap<>();
    static final Map<String,List<String>> TAGS = new LinkedHashMap<>();
    static {
        PREFIXES.put("campus_environment","env_demo_"); PREFIXES.put("campus_energy","energy_demo_");
        PREFIXES.put("campus_facility","facility_demo_"); PREFIXES.put("campus_lighting","light_demo_");
        TAGS.put("campus_environment",List.of("temperature_c","humidity_pct"));
        TAGS.put("campus_energy",List.of("voltage_v","power_kw"));
        TAGS.put("campus_facility",List.of("run_state","equipment_temperature_c"));
        TAGS.put("campus_lighting",List.of("illuminance_lux"));
    }
    interface Read { Object run() throws Exception; }
    static Map<String,Object> probe(Read read) {
        Map<String,Object> output = new LinkedHashMap<>();
        try { output.put("status","PASS"); output.put("data",read.run()); }
        catch (AiriotException e) { output.put("status","FAIL"); output.put("code",e.getCode()); output.put("beStatus",e.getHttpStatus()); }
        catch (Exception e) { output.put("status","FAIL"); output.put("code","UNEXPECTED_EXCEPTION"); }
        return output;
    }
    static Long timestamp(JsonNode node) {
        if (node == null || node.isNull()) return null;
        try { if (node.isNumber() || node.asText().matches("[0-9]{10,16}")) { long value = node.asLong(); return value < 1000000000000L ? value * 1000 : value; } return Instant.parse(node.asText()).toEpochMilli(); }
        catch (Exception e) { return null; }
    }
    static String key(JsonNode node) { return node.path("tableId").asText()+"/"+node.path("id").asText()+"/"+node.path("tagId").asText(); }
    static Map<String,Object> recordSummary(JsonNode records) {
        List<String> ids=new ArrayList<>();int simulated=0;for(JsonNode record:records){ids.add(record.path("id").asText());if(record.path("is_simulated").isBoolean()&&record.path("is_simulated").booleanValue())simulated++;}
        Map<String,Object> output=new LinkedHashMap<>();output.put("count",records.size());output.put("ids",ids);output.put("simulatedTrue",simulated);
        if(!records.isEmpty()){JsonNode first=records.get(0);List<String> keys=new ArrayList<>();first.fieldNames().forEachRemaining(keys::add);output.put("firstRecordKeys",keys);Map<String,Object> selected=new LinkedHashMap<>();for(String field:List.of("id","name","location_code","online","is_simulated","simulated_switch_on")){JsonNode value=first.get(field);selected.put(field,value==null?null:value.isBoolean()?value.booleanValue():value.isTextual()?value.asText():null);}output.put("safeFirstRecord",selected);}
        return output;
    }
    static Map<String,Object> latestSummary(JsonNode values) {
        int numeric=0; int validTimes=0; Set<String> keys=new HashSet<>(); Map<String,Long> times=new TreeMap<>();
        for(JsonNode value:values) { keys.add(key(value)); if(value.path("value").isNumber())numeric++; Long time=timestamp(value.get("time")); if(time!=null){validTimes++;times.put(key(value),time);} }
        return Map.of("count",values.size(),"uniqueTargets",keys.size(),"numericValues",numeric,"validTimes",validTimes,"sampleTimes",times);
    }
    static Map<String,Object> historySummary(JsonNode raw,String tag) {
        int rows=0,seriesCount=0; List<Object> structures=new ArrayList<>(); Long first=null,last=null; int validTimes=0,numeric=0;
        for(JsonNode result:raw.path("results")) for(JsonNode series:result.path("series")) {
            seriesCount++; List<String> columns=new ArrayList<>(); for(JsonNode column:series.path("columns")) columns.add(column.asText());
            int ti=columns.indexOf("time"),vi=columns.indexOf(tag); structures.add(Map.of("columns",columns,"rows",series.path("values").size()));
            for(JsonNode row:series.path("values")){rows++; if(vi>=0&&row.path(vi).isNumber())numeric++; Long time=ti<0?null:timestamp(row.get(ti)); if(time!=null){validTimes++;if(first==null||time<first)first=time;if(last==null||time>last)last=time;} }
        }
        Map<String,Object> out=new LinkedHashMap<>();out.put("rootType",raw.getNodeType().name());out.put("results",raw.path("results").size());out.put("series",seriesCount);out.put("structures",structures);out.put("samples",rows);out.put("numericSamples",numeric);out.put("validTimes",validTimes);out.put("firstTime",first);out.put("lastTime",last);return out;
    }
    public static void main(String[] args) throws Exception {
        Map<String,Object> report=new LinkedHashMap<>(); boolean full=args.length>1&&args[1].equals("full");
        try {
            if (args.length != 3 || args[2].isBlank()) throw new IllegalArgumentException("Explicit gateway is required");
            Properties secrets=new Properties();try(var reader=Files.newBufferedReader(Path.of(args[0]))){secrets.load(reader);}
            AiriotProperties properties=new AiriotProperties();properties.setBaseUrl(args[2]);
            properties.setAppKey(secrets.getProperty("campus.airiot.app-key",secrets.getProperty("app-key","")));
            properties.setAppSecret(secrets.getProperty("campus.airiot.app-secret",secrets.getProperty("app-secret","")));
            properties.setControlEnabled(false);
            AiriotClient client=new AiriotClient(properties,JSON);
            Map<String,Object> identity=client.status();
            report.put("authentication",Map.of("configured",Boolean.TRUE.equals(identity.get("configured")),"connected",Boolean.TRUE.equals(identity.get("connected")),"isSuperFalse",Boolean.FALSE.equals(identity.get("isSuper"))));
            if(!Boolean.TRUE.equals(identity.get("connected"))||!Boolean.FALSE.equals(identity.get("isSuper"))){report.put("code","MACHINE_IDENTITY_NOT_ACCEPTED");System.out.println(JSON.writeValueAsString(report));return;}
            Map<String,Object> tables=new LinkedHashMap<>();List<String> tableNames=new ArrayList<>();tableNames.add("campus_space");tableNames.addAll(PREFIXES.keySet());
            for(String table:tableNames) tables.put(table,probe(()->recordSummary(client.records(table))));
            report.put("tables",tables);
            List<Map<String,String>> refs=new ArrayList<>();for(String table:PREFIXES.keySet())for(int n=1;n<=4;n++)for(String tag:TAGS.get(table))refs.add(Map.of("tableId",table,"id",PREFIXES.get(table)+String.format("%02d",n),"tagId",tag));
            long observedAt=System.currentTimeMillis();JsonNode firstLatest=null; if(full){try{firstLatest=client.latest(refs);report.put("latestRound1",Map.of("status","PASS","data",latestSummary(firstLatest)));}catch(AiriotException e){report.put("latestRound1",Map.of("status","FAIL","code",e.getCode(),"beStatus",e.getHttpStatus()));}}
            Map<String,Object> histories=new LinkedHashMap<>();long to=System.currentTimeMillis(),from=to-3600000;
            List<Map<String,String>> historyRefs=full?refs:List.of(refs.get(0),refs.get(refs.size()-1));
            for(Map<String,String> ref:historyRefs){String table=ref.get("tableId"),id=ref.get("id"),tag=ref.get("tagId");histories.put(table+"/"+id+"/"+tag,probe(()->historySummary(client.history(table,id,tag,from,to,1001),tag)));}
            report.put("historyRange",Map.of("from",from,"to",to));report.put("histories",histories);
            report.put("alarms",probe(()->{JsonNode raw=client.alarms(50,0);Map<String,Object> out=new LinkedHashMap<>();out.put("rootType",raw.getNodeType().name());out.put("itemsType",raw.path("items").getNodeType().name());out.put("count",raw.path("items").size());out.put("total",raw.path("total").isNumber()?raw.path("total").asLong():null);List<String> firstKeys=new ArrayList<>();if(!raw.path("items").isEmpty())raw.path("items").get(0).fieldNames().forEachRemaining(firstKeys::add);out.put("firstItemKeys",firstKeys);return out;}));
            if(full){long wait=Math.max(0,16000-(System.currentTimeMillis()-observedAt));if(wait>0)Thread.sleep(wait);report.put("latestRoundSeparationMs",System.currentTimeMillis()-observedAt);JsonNode first=firstLatest;report.put("latestRound2",probe(()->{JsonNode second=client.latest(refs);Map<String,Object> out=new LinkedHashMap<>(latestSummary(second));Map<String,Long> before=new HashMap<>();if(first!=null)for(JsonNode v:first){Long time=timestamp(v.get("time"));if(time!=null)before.put(key(v),time);}int advanced=0,unchanged=0;for(JsonNode v:second){Long time=timestamp(v.get("time")),old=before.get(key(v));if(time!=null&&old!=null){if(time>old)advanced++;else unchanged++;}}out.put("advancedTargets",advanced);out.put("notAdvancedTargets",unchanged);return out;}));}
            report.put("writesPerformed",false);
        }catch(Exception e){report.put("status","FAIL");report.put("code","SAFE_RUNNER_ERROR");}
        System.out.println(JSON.writeValueAsString(report));
    }
}
