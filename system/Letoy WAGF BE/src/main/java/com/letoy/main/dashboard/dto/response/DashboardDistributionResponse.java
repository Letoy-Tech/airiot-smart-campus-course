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
public class DashboardDistributionResponse {
    private List<DashboardDistributionItemResponse> usersByRole;
    private List<DashboardDistributionItemResponse> usersByGroup;
}
