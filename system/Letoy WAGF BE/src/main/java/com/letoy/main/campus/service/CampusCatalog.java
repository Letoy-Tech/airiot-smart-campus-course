package com.letoy.main.campus.service;

import com.letoy.main.campus.dto.CampusDtos.Tag;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Approved simulation identities and metadata, not substitute device records or values. */
@Component
public class CampusCatalog {
    public static final String PROJECT_ID = "000000000000000000000001";
    public static final Set<String> SPACE_IDS = Set.of("demo_room_101", "demo_room_102", "demo_room_103", "demo_room_104");
    public record DeviceSpec(String id, String table, String category, List<Tag> tags, boolean controllable) { }
    private final Map<String, DeviceSpec> devices;
    private final List<String> tables = List.of("campus_environment", "campus_energy", "campus_facility", "campus_lighting");

    public CampusCatalog() {
        Map<String, DeviceSpec> map = new LinkedHashMap<>();
        add(map, "env_demo_", "campus_environment", "environment",
                List.of(new Tag("temperature_c", "温度", "°C"), new Tag("humidity_pct", "湿度", "%")), false);
        add(map, "energy_demo_", "campus_energy", "energy",
                List.of(new Tag("voltage_v", "电压", "V"), new Tag("power_kw", "功率", "kW")), false);
        add(map, "facility_demo_", "campus_facility", "facility",
                List.of(new Tag("run_state", "运行状态", ""), new Tag("equipment_temperature_c", "设备温度", "°C")), true);
        add(map, "light_demo_", "campus_lighting", "lighting", List.of(new Tag("illuminance_lux", "照度", "lux")), true);
        devices = Map.copyOf(map);
    }
    private void add(Map<String, DeviceSpec> map, String prefix, String table, String category, List<Tag> tags, boolean control) {
        for (int i = 1; i <= 4; i++) {
            String id = prefix + String.format("%02d", i);
            map.put(id, new DeviceSpec(id, table, category, tags, control));
        }
    }
    public List<String> tables() { return tables; }
    public DeviceSpec find(String id) { return id == null ? null : devices.get(id); }
    public DeviceSpec require(String id) {
        DeviceSpec spec = find(id);
        if (spec == null) throw CampusException.badRequest("设备不在已批准的 16 个模拟对象范围内");
        return spec;
    }
    public Tag requireTag(DeviceSpec spec, String tagId) {
        return spec.tags().stream().filter(tag -> tag.id().equals(tagId)).findFirst()
                .orElseThrow(() -> CampusException.badRequest("采集点不属于该设备的已批准范围"));
    }
}
