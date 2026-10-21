package com.letoy.main.dashboard.mapper;

import com.letoy.main.dashboard.dto.response.DashboardDistributionItemResponse;
import com.letoy.main.dashboard.dto.response.DashboardTrendPointResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface DashboardMapper {

    long countTotalUsers();

    long countActiveUsers();

    long countLockedUsers();

    long countNewUsersSince(@Param("startTime") LocalDateTime startTime);

    long countOnlineSessions();

    long countOnlineUsers();

    long countEnabledApiRules();

    long countGroups();

    long countEnabledGroups();

    long countRoles();

    long countEnabledRoles();

    long countPasswordChangedSince(@Param("startTime") LocalDateTime startTime);

    List<DashboardTrendPointResponse> countUserGrowthByDate(@Param("startTime") LocalDateTime startTime);

    List<DashboardTrendPointResponse> countOnlineUserTrendByDate(@Param("startTime") LocalDateTime startTime);

    List<DashboardDistributionItemResponse> countUsersByRole();
}
