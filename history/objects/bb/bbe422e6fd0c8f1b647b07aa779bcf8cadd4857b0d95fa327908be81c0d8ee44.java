package edu.campus.course;

import static edu.campus.course.CourseModels.*;

import com.fasterxml.jackson.databind.JsonNode;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Profile("teacher-db")
public class LocationService {
    private final CampusMapper mapper;
    private final CampusProvider provider;

    public LocationService(CampusMapper mapper, CampusProvider provider) {
        this.mapper = mapper;
        this.provider = provider;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> locations() {
        return Map.of(
                "campuses",
                mapper.campuses(),
                "buildings",
                mapper.buildings(),
                "bindings",
                mapper.bindings());
    }

    @Transactional
    public Campus createCampus(JsonNode body) {
        Access.admin();
        Inputs.fields(body, "name");
        Campus c = new Campus(UUID.randomUUID().toString(), Inputs.text(body, "name", 80));
        mapper.insertCampus(c);
        return c;
    }

    @Transactional
    public Building createBuilding(JsonNode body) {
        Access.admin();
        Inputs.fields(body, "campusId", "name");
        String id = Inputs.text(body, "campusId", 64), name = Inputs.text(body, "name", 80);
        if (mapper.campus(id) == null) throw ApiFailure.missing();
        Building b = new Building(UUID.randomUUID().toString(), id, name);
        mapper.insertBuilding(b);
        return b;
    }

    @Transactional
    public Binding bind(String spaceId, JsonNode body) {
        Access.admin();
        Inputs.fields(body, "buildingId", "floor");
        String buildingId = Inputs.text(body, "buildingId", 64),
                floor = Inputs.nullableText(body, "floor", 40);
        validateBinding(spaceId, buildingId);
        Binding b = new Binding(spaceId, buildingId, floor);
        mapper.bind(b);
        return b;
    }

    public void validateBinding(String spaceId, String buildingId) {
        // STUDENT_TODO_C05_BEGIN
        throw new ApiFailure(501, "TODO_C05");
        // STUDENT_TODO_C05_END
    }

    @Transactional(readOnly = true)
    public CatalogReader.Items<CatalogReader.Space> spaces() {
        Map<String, Building> buildings = new HashMap<>();
        mapper.buildings().forEach(b -> buildings.put(b.id(), b));
        Map<String, Binding> bindings = new HashMap<>();
        mapper.bindings().forEach(b -> bindings.put(b.spaceId(), b));
        var items =
                provider.spaces().items().stream()
                        .map(
                                s -> {
                                    Binding binding = bindings.get(s.id());
                                    if (binding == null) return s;
                                    Building building = buildings.get(binding.buildingId());
                                    return new CatalogReader.Space(
                                            s.id(),
                                            s.name(),
                                            s.type(),
                                            building.campusId(),
                                            building.id(),
                                            binding.floor());
                                })
                        .toList();
        return new CatalogReader.Items<>(items, provider.spaces().observedAt());
    }
}
