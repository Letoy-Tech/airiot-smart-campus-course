package com.letoy.main.dashboard.controller;

import com.letoy.main.common.dto.ApiResponse;
import com.letoy.main.dashboard.dto.response.DashboardDistributionResponse;
import com.letoy.main.dashboard.dto.response.DashboardHealthResponse;
import com.letoy.main.dashboard.dto.response.DashboardOverviewResponse;
import com.letoy.main.dashboard.dto.response.DashboardTrendsResponse;
import com.letoy.main.dashboard.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/dashboard")
@Tag(name = "Dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/overview")
    @Operation(summary = "Get dashboard overview metrics")
    public ApiResponse<DashboardOverviewResponse> overview() {
        return ApiResponse.success(dashboardService.getOverview());
    }

    @GetMapping("/trends")
    @Operation(summary = "Get dashboard trend metrics")
    public ApiResponse<DashboardTrendsResponse> trends(@RequestParam(defaultValue = "7") Integer days) {
        return ApiResponse.success(dashboardService.getTrends(days == null ? 7 : days));
    }

    @GetMapping("/distribution")
    @Operation(summary = "Get dashboard distribution metrics")
    public ApiResponse<DashboardDistributionResponse> distribution() {
        return ApiResponse.success(dashboardService.getDistribution());
    }

    @GetMapping("/health")
    @Operation(summary = "Get dashboard health metrics")
    public ApiResponse<DashboardHealthResponse> health() {
        return ApiResponse.success(dashboardService.getHealth());
    }
}
