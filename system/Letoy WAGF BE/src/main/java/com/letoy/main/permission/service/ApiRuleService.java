package com.letoy.main.permission.service;


import com.github.pagehelper.PageInfo;
import com.letoy.main.permission.dto.request.ApiRuleQueryRequest;
import com.letoy.main.permission.entity.ApiRule;

import java.util.List;

public interface ApiRuleService {
    List<ApiRule> getAllEnabledCached();   // 运行期匹配使用（带TTL缓存）
    PageInfo<ApiRule> listAll(Integer currentPage, Integer pageSize);               // 管理端列表
    PageInfo<ApiRule> queryWithFilter(ApiRuleQueryRequest dto);  // 带筛选的分页查询
    ApiRule getById(Long id);
    Long create(ApiRule rule);
    int update(ApiRule rule);
    int delete(Long id);
    int enable(Long id, boolean enabled);
    void rebuildCacheNow();                // 主动重建匹配缓存
}