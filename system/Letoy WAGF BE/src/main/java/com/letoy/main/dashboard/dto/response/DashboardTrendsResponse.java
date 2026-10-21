package com.letoy.main.dashboard.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardTrendsResponse {
    private int days;
    private List<DashboardTrendPointResponse> userGrowth;
    private List<DashboardTrendPointResponse> onlineUserTrends;
}
