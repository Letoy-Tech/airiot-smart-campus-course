package com.letoy.main.dashboard.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardOverviewResponse {
    private long totalUsers;
    private long activeUsers;
    private long lockedUsers;
    private long newUsers7d;
    private long onlineSessions;
    private long onlineUsers;
    private long enabledApiRules;
    private long groupsCount;
    private long enabledGroups;
    private long rolesCount;
    private long enabledRoles;
    private long passwordChanged24h;
}
