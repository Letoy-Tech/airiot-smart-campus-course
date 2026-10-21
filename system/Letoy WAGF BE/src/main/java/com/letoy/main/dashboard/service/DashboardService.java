package com.letoy.main.dashboard.service;

import com.letoy.main.dashboard.dto.response.DashboardDistributionResponse;
import com.letoy.main.dashboard.dto.response.DashboardHealthResponse;
import com.letoy.main.dashboard.dto.response.DashboardOverviewResponse;
import com.letoy.main.dashboard.dto.response.DashboardTrendsResponse;

public interface DashboardService {

    DashboardOverviewResponse getOverview();

    DashboardTrendsResponse getTrends(int days);

    DashboardDistributionResponse getDistribution();

    DashboardHealthResponse getHealth();
}
