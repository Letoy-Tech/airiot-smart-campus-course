package com.letoy.main.auth.security;

import com.alibaba.fastjson2.JSON;
import com.letoy.main.permission.entity.ApiRule;
import com.letoy.main.common.util.RedisUtil;
import org.springframework.http.server.PathContainer;
import org.springframework.stereotype.Component;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

import jakarta.annotation.Resource;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class ApiRuleMatcher {

    // Redis Set：成員為 ApiRule 的 JSON 字串
    private static final String RULES_KEY = "SEC:API_RULES";
    private static final long CACHE_TTL_MS = Duration.ofSeconds(60).toMillis();

    private final PathPatternParser parser = new PathPatternParser();

    @Resource
    private RedisUtil redisUtil;

    /** Redis key前缀(从配置读取) */
    @org.springframework.beans.factory.annotation.Value("${template.app-name}")
    private String appName;

    /** 字符串专用 RedisTemplate - 用于读取 API 规则(纯字符串) */
    @Resource(name = "apiRuleRedisTemplate")
    private org.springframework.data.redis.core.RedisTemplate<String, String> apiRuleRedisTemplate;

    private volatile List<CompiledRule> cache = Collections.emptyList();
    private final AtomicLong lastLoadAt = new AtomicLong(0);

    public static final class Match {
        private final ApiRule rule;
        private final Map<String, String> pathVars;
        public Match(ApiRule rule, Map<String, String> pathVars) {
            this.rule = rule;
            this.pathVars = pathVars;
        }
        public ApiRule getRule() { return rule; }
        public Map<String, String> getPathVars() { return pathVars; }
    }

    private static final class CompiledRule {
        ApiRule rule;
        PathPattern pattern;
        int specificity; // 越大越“具體”
    }

    /** 主匹配入口 */
    public Optional<Match> match(String uri, String method) {
        ensureCache();

        PathContainer path = PathContainer.parsePath(uri);
        String m = method == null ? "" : method.toUpperCase(Locale.ROOT);

        for (CompiledRule cr : cache) {
            boolean methodMatch = methodAllowed(cr.rule.getMethods(), m);

            if (!methodMatch) continue;

            PathPattern.PathMatchInfo info = cr.pattern.matchAndExtract(path);

            if (info != null) {
                Map<String, String> vars = new HashMap<>();
                info.getUriVariables().forEach(vars::put);
                return Optional.of(new Match(cr.rule, vars));
            }
        }

        return Optional.empty();
    }

    /** 規則未填 methods 視為不限；否則按 CSV（忽略大小寫/空白）判斷 */
    private boolean methodAllowed(String methodsCsv, String m) {
        if (methodsCsv == null || methodsCsv.isBlank()) return true;
        if (m == null || m.isBlank()) return false;
        for (String token : methodsCsv.split(",")) {
            if (m.equalsIgnoreCase(token.trim())) {
                return true;
            }
        }
        return false;
    }

    /** 構建/刷新本地快取（從 Redis Set 裡讀） */
    private void ensureCache() {
        long now = System.currentTimeMillis();
        if (now - lastLoadAt.get() < CACHE_TTL_MS && !cache.isEmpty()) return;

        synchronized (this) {
            if (now - lastLoadAt.get() < CACHE_TTL_MS && !cache.isEmpty()) return;

            // 使用 apiRuleRedisTemplate 直接读取字符串（不经过对象序列化）
            String prefixedKey = appName + "-" + RULES_KEY;
            Set<String> members = apiRuleRedisTemplate.opsForSet().members(prefixedKey);

            List<CompiledRule> list = new ArrayList<>();
            if (members != null && !members.isEmpty()) {
                for (String jsonStr : members) {
                    try {
                        ApiRule r = JSON.parseObject(jsonStr, ApiRule.class);
                        if (r == null || r.getPattern() == null || r.getPattern().isBlank()) continue;

                        CompiledRule cr = new CompiledRule();
                        cr.rule = r;
                        cr.pattern = parser.parse(r.getPattern());
                        cr.specificity = calcSpecificity(r.getPattern(), safePriority(r.getPriority()));
                        list.add(cr);
                    } catch (Exception ignore) {
                        // 單條解析失敗忽略，避免影響整體
                    }
                }
            }
            // 具體度 + priority 排序（大在前）
            list.sort((a, b) -> Integer.compare(b.specificity, a.specificity));
            cache = list;
            lastLoadAt.set(now);
        }
    }

    private int safePriority(Integer p) {
        return p == null ? 0 : p;
    }

    /** 簡易“具體度”計分：靜態段 +2，{var} +1，** +0，再疊加 priority */
    private int calcSpecificity(String pattern, Integer priority) {
        int base = 0;
        for (String seg : pattern.split("/")) {
            if (seg.isEmpty()) continue;
            if ("**".equals(seg)) base += 0;
            else if (seg.startsWith("{") && seg.endsWith("}")) base += 1;
            else base += 2;
        }
        if (priority != null) base += priority;
        return base;
    }
}
