package edu.campus.v2.web;

import edu.campus.v2.overview.Overview;
import edu.campus.v2.overview.OverviewService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 概览接口：只负责接收请求、交给服务层、按统一结构返回。
 * /api 下除 /api/health 与 /api/login 外都由 SessionAuthFilter 要求 Bearer 令牌，
 * 因此本接口必须先登录；三个课程角色都可以读取，不额外限制角色。
 */
@RestController
@RequestMapping("/api")
public class OverviewController {

    private final OverviewService overviewService;

    public OverviewController(OverviewService overviewService) {
        this.overviewService = overviewService;
    }

    @GetMapping("/overview")
    public ApiResponse<Overview> overview() {
        return ApiResponse.ok(overviewService.loadOverview());
    }
}
