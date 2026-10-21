package com.letoy.main.campus.service;

import com.letoy.main.auth.entity.AuthUser;
import com.letoy.main.campus.airiot.AiriotProperties;
import com.letoy.main.campus.dto.CampusDtos.Capabilities;
import com.letoy.main.campus.dto.CampusAlarmDtos.Handler;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.user.mapper.UserInfoMapper;
import com.letoy.main.role.mapper.RoleInfoMapper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CampusAccess {
    private final UserInfoMapper users;
    private final RoleInfoMapper roleDefinitions;
    private final AiriotProperties airiotProperties;
    public CampusAccess(UserInfoMapper users, RoleInfoMapper roleDefinitions, AiriotProperties airiotProperties) {
        this.users = users;
        this.roleDefinitions = roleDefinitions;
        this.airiotProperties = airiotProperties;
    }
    public record Actor(String id, String name, List<String> roles) { }
    public Actor actor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AuthUser principal)) {
            throw new CampusException(401, "LOGIN_REQUIRED", "请登录后访问智慧校园");
        }
        UserInfo user = users.getUserInfoByUid(principal.getId());
        if (user == null || !Boolean.TRUE.equals(user.getActive()) || Boolean.TRUE.equals(user.getAccountLocked())) {
            throw CampusException.denied();
        }
        Set<String> enabled = enabledRoles();
        return new Actor(user.getUid(), user.getUsername(), user.getRoleList().stream().filter(enabled::contains).toList());
    }
    private Set<String> enabledRoles() {
        return roleDefinitions.selectAll(null, 1).stream()
                .filter(role -> Integer.valueOf(1).equals(role.getStatus()))
                .map(com.letoy.main.role.entity.RoleInfo::getRoleCode).collect(Collectors.toSet());
    }
    public Capabilities capabilities() { return capabilities(actor()); }
    public Capabilities capabilities(Actor actor) {
        boolean admin = actor.roles().contains("SUPER_ADMIN") || actor.roles().contains("ADMIN");
        boolean roleManagement = admin || actor.roles().contains("CAMPUS_MANAGER");
        boolean control = roleManagement && airiotProperties.isControlEnabled();
        boolean read = roleManagement || actor.roles().contains("CAMPUS_VIEWER");
        return new Capabilities(actor.roles(), read, control, admin, admin, roleManagement, admin, admin);
    }
    public void requireRead() { if (!capabilities().canRead()) throw CampusException.denied(); }
    public void requireAdmin() { if (!capabilities().canAdmin()) throw CampusException.denied(); }
    public void requireControl(Actor actor) { if (!capabilities(actor).canControl()) throw CampusException.denied(); }
    public void requireHandleAlarms(Actor actor) { if (!capabilities(actor).canHandleAlarms()) throw CampusException.denied(); }
    public List<Handler> alarmHandlers() {
        requireRead();
        Set<String> enabled = enabledRoles();
        return users.getAllUsers().stream().filter(user -> eligibleHandler(user, enabled))
                .map(this::handlerView).sorted(java.util.Comparator.comparing(Handler::displayName).thenComparing(Handler::uid)).toList();
    }
    public Handler alarmHandler(String uid) {
        UserInfo user = users.getUserInfoByUid(uid);
        if (!eligibleHandler(user, enabledRoles())) throw CampusException.badRequest("负责人必须是启用且未锁定的校园管理员或管理人员");
        return handlerView(user);
    }
    private boolean eligibleHandler(UserInfo user, Set<String> enabled) {
        return user != null && Boolean.TRUE.equals(user.getActive()) && !Boolean.TRUE.equals(user.getAccountLocked())
                && user.getRoleList().stream().filter(enabled::contains)
                .anyMatch(Set.of("SUPER_ADMIN", "ADMIN", "CAMPUS_MANAGER")::contains);
    }
    private Handler handlerView(UserInfo user) {
        String displayName = user.getNickname() == null || user.getNickname().isBlank() ? user.getUsername() : user.getNickname();
        return new Handler(user.getUid(), displayName);
    }
}
