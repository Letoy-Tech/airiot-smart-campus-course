package com.letoy.main.dashboard.service.impl;

import com.letoy.main.dashboard.dto.response.DashboardDistributionItemResponse;
import com.letoy.main.dashboard.dto.response.DashboardDistributionResponse;
import com.letoy.main.dashboard.dto.response.DashboardHealthItemResponse;
import com.letoy.main.dashboard.dto.response.DashboardHealthResponse;
import com.letoy.main.dashboard.dto.response.DashboardOverviewResponse;
import com.letoy.main.dashboard.dto.response.DashboardTrendPointResponse;
import com.letoy.main.dashboard.dto.response.DashboardTrendsResponse;
import com.letoy.main.dashboard.mapper.DashboardMapper;
import com.letoy.main.dashboard.service.DashboardService;
import com.letoy.main.group.entity.GroupsInfo;
import com.letoy.main.group.service.GroupsInfoService;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.user.service.UserInfoService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.CompositeHealth;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthComponent;
import org.springframework.boot.actuate.health.HealthEndpoint;
import org.springframework.boot.actuate.health.Status;
import org.springframework.stereotype.Service;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DashboardServiceImpl implements DashboardService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;

    private final DashboardMapper dashboardMapper;
    private final UserInfoService userInfoService;
    private final GroupsInfoService groupsInfoService;
    private final HealthEndpoint healthEndpoint;

    @Value("${spring.ai.openai.base-url:}")
    private String aiBaseUrl;

    @Value("${spring.ai.openai.api-key:}")
    private String aiApiKey;

    public DashboardServiceImpl(DashboardMapper dashboardMapper,
                                UserInfoService userInfoService,
                                GroupsInfoService groupsInfoService,
                                HealthEndpoint healthEndpoint) {
        this.dashboardMapper = dashboardMapper;
        this.userInfoService = userInfoService;
        this.groupsInfoService = groupsInfoService;
        this.healthEndpoint = healthEndpoint;
    }

    @Override
    public DashboardOverviewResponse getOverview() {
        LocalDateTime now = LocalDateTime.now();
        return DashboardOverviewResponse.builder()
                .totalUsers(dashboardMapper.countTotalUsers())
                .activeUsers(dashboardMapper.countActiveUsers())
                .lockedUsers(dashboardMapper.countLockedUsers())
                .newUsers7d(dashboardMapper.countNewUsersSince(now.minusDays(6).toLocalDate().atStartOfDay()))
                .onlineSessions(dashboardMapper.countOnlineSessions())
                .onlineUsers(dashboardMapper.countOnlineUsers())
                .enabledApiRules(dashboardMapper.countEnabledApiRules())
                .groupsCount(dashboardMapper.countGroups())
                .enabledGroups(dashboardMapper.countEnabledGroups())
                .rolesCount(dashboardMapper.countRoles())
                .enabledRoles(dashboardMapper.countEnabledRoles())
                .passwordChanged24h(dashboardMapper.countPasswordChangedSince(now.minusHours(24)))
                .build();
    }

    @Override
    public DashboardTrendsResponse getTrends(int days) {
        int safeDays = Math.max(1, Math.min(days, 30));
        LocalDate startDate = LocalDate.now().minusDays(safeDays - 1L);
        LocalDateTime startTime = startDate.atStartOfDay();

        return DashboardTrendsResponse.builder()
                .days(safeDays)
                .userGrowth(fillMissingDates(dashboardMapper.countUserGrowthByDate(startTime), startDate, safeDays))
                .onlineUserTrends(fillMissingDates(dashboardMapper.countOnlineUserTrendByDate(startTime), startDate, safeDays))
                .build();
    }

    @Override
    public DashboardDistributionResponse getDistribution() {
        return DashboardDistributionResponse.builder()
                .usersByRole(dashboardMapper.countUsersByRole())
                .usersByGroup(buildUsersByGroup())
                .build();
    }

    @Override
    public DashboardHealthResponse getHealth() {
        HealthComponent component = healthEndpoint.health();
        List<DashboardHealthItemResponse> items = new ArrayList<>();
        items.add(DashboardHealthItemResponse.builder()
                .name("Application")
                .status(extractStatus(component))
                .detail("Actuator overall health")
                .build());
        items.add(buildHealthItem("Database", component, "db"));
        items.add(buildHealthItem("Redis", component, "redis"));
        items.add(buildAiHealthItem());
        return DashboardHealthResponse.builder().items(items).build();
    }

    private List<DashboardTrendPointResponse> fillMissingDates(List<DashboardTrendPointResponse> rows,
                                                               LocalDate startDate,
                                                               int days) {
        Map<String, Long> valueByDate = new LinkedHashMap<>();
        if (rows != null) {
            for (DashboardTrendPointResponse row : rows) {
                valueByDate.put(row.getDate(), row.getValue());
            }
        }

        List<DashboardTrendPointResponse> result = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            LocalDate current = startDate.plusDays(i);
            String date = current.format(DATE_FORMATTER);
            result.add(new DashboardTrendPointResponse(date, valueByDate.getOrDefault(date, 0L)));
        }
        return result;
    }

    private List<DashboardDistributionItemResponse> buildUsersByGroup() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (GroupsInfo group : groupsInfoService.getAllGroups()) {
            counts.put(group.getGroupId(), 0L);
        }

        for (UserInfo user : userInfoService.getAllUsersWithGroups()) {
            for (String groupId : user.getGroupIdList()) {
                counts.merge(groupId, 1L, Long::sum);
            }
        }

        List<DashboardDistributionItemResponse> result = new ArrayList<>();
        for (GroupsInfo group : groupsInfoService.getAllGroups()) {
            result.add(DashboardDistributionItemResponse.builder()
                    .name(group.getGroupName() != null && !group.getGroupName().isBlank() ? group.getGroupName() : group.getGroupId())
                    .value(counts.getOrDefault(group.getGroupId(), 0L))
                    .build());
        }
        return result;
    }

    private DashboardHealthItemResponse buildHealthItem(String name, HealthComponent root, String componentName) {
        HealthComponent component = getNamedHealthComponent(root, componentName);
        return DashboardHealthItemResponse.builder()
                .name(name)
                .status(extractStatus(component))
                .detail(component == null ? "Not exposed" : componentName + " health")
                .build();
    }

    private DashboardHealthItemResponse buildAiHealthItem() {
        if (aiBaseUrl == null || aiBaseUrl.isBlank() || aiApiKey == null || aiApiKey.isBlank()) {
            return DashboardHealthItemResponse.builder()
                    .name("AI Service")
                    .status("DOWN")
                    .detail("AI base URL or API key is missing")
                    .build();
        }

        try {
            URI uri = URI.create(aiBaseUrl.trim());
            String host = uri.getHost();
            int port = uri.getPort() > 0 ? uri.getPort() : ("https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80);
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), 2000);
            }
            return DashboardHealthItemResponse.builder()
                    .name("AI Service")
                    .status("UP")
                    .detail("TCP connectivity to " + host + ":" + port)
                    .build();
        } catch (Exception exception) {
            return DashboardHealthItemResponse.builder()
                    .name("AI Service")
                    .status("DOWN")
                    .detail(exception.getMessage())
                    .build();
        }
    }

    private HealthComponent getNamedHealthComponent(HealthComponent root, String componentName) {
        if (root instanceof CompositeHealth compositeHealth) {
            return compositeHealth.getComponents().get(componentName);
        }
        return null;
    }

    private String extractStatus(HealthComponent component) {
        if (component == null) {
            return "UNKNOWN";
        }
        if (component instanceof Health health) {
            Status status = health.getStatus();
            return status != null ? status.getCode() : "UNKNOWN";
        }
        if (component instanceof CompositeHealth compositeHealth) {
            Status status = compositeHealth.getStatus();
            return status != null ? status.getCode() : "UNKNOWN";
        }
        return "UNKNOWN";
    }
}
