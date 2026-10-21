package com.letoy.main.permission.service.impl;

import com.alibaba.fastjson2.JSON;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import com.letoy.main.permission.mapper.ApiRuleMapper;
import com.letoy.main.permission.entity.ApiRule;
import com.letoy.main.permission.service.ApiRuleService;
import com.letoy.main.common.util.RedisUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.Resource;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class ApiRuleServiceImpl implements ApiRuleService {

    private static final Logger log = LoggerFactory.getLogger(ApiRuleServiceImpl.class);
    private static final String RULES_KEY = "SEC:API_RULES";
    private static final long TTL_MS = 60_000;

    @Resource
    private ApiRuleMapper apiRuleMapper;

    @Value("${security.api-rule.sync-redis:false}")
    private boolean syncRedis;

    @Resource
    private RedisUtil redisUtil;

    @Value("${template.app-name}")
    private String appName;

    @Resource(name = "apiRuleRedisTemplate")
    private org.springframework.data.redis.core.RedisTemplate<String, String> apiRuleRedisTemplate;

    private volatile List<ApiRule> cache = Collections.emptyList();
    private final AtomicLong lastLoad = new AtomicLong(0);

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (syncRedis) {
            syncRedisIfNeeded();
        }
    }

    @Override
    public List<ApiRule> getAllEnabledCached() {
        long now = System.currentTimeMillis();
        if (now - lastLoad.get() < TTL_MS && !cache.isEmpty()) {
            return cache;
        }
        synchronized (this) {
            if (now - lastLoad.get() < TTL_MS && !cache.isEmpty()) {
                return cache;
            }
            cache = apiRuleMapper.getAllEnabled();
            lastLoad.set(now);
            return cache;
        }
    }

    @Override
    public PageInfo<ApiRule> listAll(Integer currentPage, Integer pageSize) {
        PageHelper.startPage(currentPage, pageSize);
        return new PageInfo<>(apiRuleMapper.getAll());
    }

    @Override
    public PageInfo<ApiRule> queryWithFilter(com.letoy.main.permission.dto.request.ApiRuleQueryRequest dto) {
        PageHelper.startPage(dto.getCurrentPage() == null ? 1 : dto.getCurrentPage(), dto.getPageSize() == null ? 10 : dto.getPageSize());
        return new PageInfo<>(apiRuleMapper.queryWithFilter(
                dto.getName(),
                dto.getPattern(),
                dto.getMethods(),
                dto.getGroupPolicy(),
                dto.getEnabled()
        ));
    }

    @Override
    public ApiRule getById(Long id) {
        return apiRuleMapper.getById(id);
    }

    @Override
    @Transactional
    public Long create(ApiRule rule) {
        normalize(rule);
        if (rule.getEnabled() == null) {
            rule.setEnabled(true);
        }
        apiRuleMapper.insert(rule);
        invalidate();
        syncRedisAsync();
        return rule.getId();
    }

    @Override
    @Transactional
    public int update(ApiRule rule) {
        normalize(rule);
        int count = apiRuleMapper.updateById(rule);
        invalidate();
        syncRedisAsync();
        return count;
    }

    @Override
    @Transactional
    public int delete(Long id) {
        int count = apiRuleMapper.deleteById(id);
        invalidate();
        syncRedisAsync();
        return count;
    }

    @Override
    @Transactional
    public int enable(Long id, boolean enabled) {
        ApiRule current = apiRuleMapper.getById(id);
        if (current == null) {
            return 0;
        }
        current.setEnabled(enabled);
        int count = apiRuleMapper.updateById(current);
        invalidate();
        syncRedisAsync();
        return count;
    }

    @Override
    public void rebuildCacheNow() {
        invalidate();
        getAllEnabledCached();
        syncRedisIfNeeded();
    }

    @Async("apiRuleSyncExecutor")
    public void syncRedisAsync() {
        syncRedisIfNeeded();
    }

    private void normalize(ApiRule rule) {
        if (rule == null) {
            return;
        }
        if (rule.getMethods() != null) {
            rule.setMethods(joinCsvUpper(rule.getMethods()));
            if (rule.getMethods().isEmpty()) {
                rule.setMethods(null);
            }
        }
        if (rule.getAllowedGroupIds() != null) {
            rule.setAllowedGroupIds(joinCsvTrim(rule.getAllowedGroupIds()));
            if (rule.getAllowedGroupIds().isEmpty()) {
                rule.setAllowedGroupIds(null);
            }
        }
        if (rule.getGroupPolicy() != null) {
            rule.setGroupPolicy(rule.getGroupPolicy().trim().toUpperCase(Locale.ROOT));
        }
        if (rule.getPriority() == null) {
            rule.setPriority(0);
        }
    }

    private String joinCsvUpper(String csv) {
        return String.join(",", Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(value -> value.toUpperCase(Locale.ROOT))
                .toList());
    }

    private String joinCsvTrim(String csv) {
        return String.join(",", Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .toList());
    }

    private void invalidate() {
        lastLoad.set(0);
    }

    private void syncRedisIfNeeded() {
        if (!syncRedis || apiRuleRedisTemplate == null) {
            return;
        }
        try {
            List<ApiRule> enabledRules = apiRuleMapper.getAllEnabled();
            String prefixedKey = appName + "-" + RULES_KEY;
            apiRuleRedisTemplate.delete(prefixedKey);
            if (enabledRules != null && !enabledRules.isEmpty()) {
                apiRuleRedisTemplate.executePipelined((RedisCallback<Object>) connection -> {
                    byte[] keyBytes = prefixedKey.getBytes(StandardCharsets.UTF_8);
                    for (ApiRule rule : enabledRules) {
                        connection.setCommands().sAdd(keyBytes, JSON.toJSONString(rule).getBytes(StandardCharsets.UTF_8));
                    }
                    return null;
                });
            }
        } catch (DataAccessException exception) {
            log.error("Failed to sync api rules to redis", exception);
        }
    }
}
