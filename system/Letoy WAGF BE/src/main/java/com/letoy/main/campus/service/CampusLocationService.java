package com.letoy.main.campus.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.letoy.main.campus.airiot.AiriotClient;
import com.letoy.main.campus.dto.CampusDtos.BindSpaceRequest;
import com.letoy.main.campus.dto.CampusDtos.CreateBuildingRequest;
import com.letoy.main.campus.dto.CampusDtos.CreateCampusRequest;
import com.letoy.main.campus.entity.CampusBuilding;
import com.letoy.main.campus.entity.CampusLocation;
import com.letoy.main.campus.entity.SpaceBinding;
import com.letoy.main.campus.mapper.CampusStoreMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CampusLocationService {
    public record Locations(List<CampusLocation> campuses, List<CampusBuilding> buildings, List<SpaceBinding> bindings) { }
    private final CampusStoreMapper store;
    private final CampusAccess access;
    private final AiriotClient client;
    public CampusLocationService(CampusStoreMapper store, CampusAccess access, AiriotClient client) {
        this.store = store;
        this.access = access;
        this.client = client;
    }
    public Locations locations() {
        access.requireRead();
        return snapshot();
    }
    Locations snapshot() { return new Locations(store.campuses(), store.buildings(), store.bindings()); }

    @Transactional
    public CampusLocation createCampus(CreateCampusRequest request) {
        access.requireAdmin();
        String name = request.name().trim();
        if (name.isEmpty() || name.length() > 80) throw CampusException.badRequest("校区名称需为 1 至 80 个字符");
        if (store.campusNamed(name) != null) throw new CampusException(409, "DUPLICATE_LOCATION", "此校区名称已存在");
        CampusLocation location = new CampusLocation();
        location.setId(UUID.randomUUID().toString());
        location.setName(name);
        try { store.insertCampus(location); }
        catch (DuplicateKeyException exception) { throw new CampusException(409, "DUPLICATE_LOCATION", "此校区名称已存在"); }
        return location;
    }
    @Transactional
    public CampusBuilding createBuilding(CreateBuildingRequest request) {
        access.requireAdmin();
        if (store.campus(request.campusId()) == null) throw CampusException.badRequest("请先选择已建立的校区");
        String name = request.name().trim();
        if (name.isEmpty() || name.length() > 80) throw CampusException.badRequest("楼栋名称需为 1 至 80 个字符");
        CampusBuilding building = new CampusBuilding();
        building.setId(UUID.randomUUID().toString());
        building.setCampusId(request.campusId());
        building.setName(name);
        try { store.insertBuilding(building); }
        catch (DuplicateKeyException exception) { throw new CampusException(409, "DUPLICATE_LOCATION", "此校区中已有同名楼栋"); }
        return building;
    }
    @Transactional
    public SpaceBinding bind(String spaceId, BindSpaceRequest request) {
        access.requireAdmin();
        if (!CampusCatalog.SPACE_IDS.contains(spaceId)) throw CampusException.badRequest("空间不在已批准的模拟对象范围内");
        if (store.building(request.buildingId()) == null) throw CampusException.badRequest("楼栋不存在");
        JsonNode record = client.record("campus_space", spaceId);
        if (!spaceId.equals(record.path("id").asText())) throw CampusException.upstream("AIRIOT 未返回对应空间，未保存绑定");
        SpaceBinding binding = new SpaceBinding();
        binding.setSpaceId(spaceId);
        binding.setBuildingId(request.buildingId());
        binding.setFloor(request.floor() == null || request.floor().trim().isEmpty() ? null : request.floor().trim());
        store.bindSpace(binding);
        return binding;
    }
}
