package com.letoy.main.auth.service;

import com.letoy.main.auth.entity.CachedPrincipal;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.user.mapper.UserInfoMapper;
import com.letoy.main.common.util.RedisUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * Principal 缓存服务 - Phase 3: 权限缓存优化
 *
 * <p><strong>设计目标</strong>：
 * <ul>
 *   <li>缓存用户 Principal（仅权限相关字段）到 Redis，TTL 5 分钟</li>
 *   <li>减少数据库查询：DynamicPermission 每次请求都查 DB → 从缓存读取</li>
 *   <li>缓存失效策略：用户修改密码/组别变更 → 清除缓存</li>
 *   <li>穿透保护：缓存 null 值（TTL 30 秒）防止恶意查询</li>
 *   <li><strong>轻量化存储</strong>：仅缓存 uid, groupIds, roles 等必需字段</li>
 * </ul>
 *
 * <p><strong>Redis Key 格式</strong>：
 * <pre>
 * SEC:PRINCIPAL:{uid}
 * </pre>
 *
 * <p><strong>缓存内容</strong>：
 * <pre>
 * {
 *   "@class": "com.letoy.main.auth.entity.CachedPrincipal",
 *   "uid": "xxx",
 *   "groupIds": "G0001,G0002",
 *   "roles": "11,22,55",
 *   "active": true,
 *   "accountLocked": false,
 *   "tokenVersion": 1
 * }
 * </pre>
 *
 * <p><strong>性能提升</strong>：
 * <ul>
 *   <li>Before: 每请求 1-2 次 DB 查询（DynamicPermission.checkPermission）</li>
 *   <li>After: 仅第一次查 DB，后续 5 分钟内从 Redis 读取</li>
 *   <li>存储优化: 仅缓存 6 个字段 vs 完整 UserInfo (15+ 字段)</li>
 *   <li>预估: DB 查询减少 95%+，响应时间降低 10-30ms，存储减少 70%+</li>
 * </ul>
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 3)
 */
@Service
public class PrincipalCacheService {

    private static final Logger logger = LoggerFactory.getLogger(PrincipalCacheService.class);

    @Autowired
    private RedisUtil redisUtil;

    @Autowired
    private UserInfoMapper userInfoMapper;

    /**
     * Redis Key 前缀
     */
    private static final String PRINCIPAL_KEY_PREFIX = "SEC:PRINCIPAL:";

    /**
     * 缓存 TTL（秒）- 5 分钟
     */
    private static final long CACHE_TTL_SECONDS = 300;

    /**
     * NULL 值缓存 TTL（秒）- 30 秒（防止缓存穿透）
     */
    private static final long NULL_CACHE_TTL_SECONDS = 30;

    /**
     * NULL 值占位符
     */
    private static final String NULL_PLACEHOLDER = "NULL";

    /**
     * 获取用户 Principal（优先从缓存读取）
     *
     * @param uid 用户 ID
     * @return UserInfo（如果不存在返回 null）
     */
    public UserInfo getPrincipal(String uid) {
        if (uid == null || uid.trim().isEmpty()) {
            return null;
        }

        String key = PRINCIPAL_KEY_PREFIX + uid;

        try {
            // 1. 尝试从缓存读取
            Object cached = redisUtil.get(key);

            if (cached != null) {
                // 缓存命中
                if (NULL_PLACEHOLDER.equals(cached)) {
                    logger.debug("缓存命中（NULL）: uid={}", uid);
                    return null;
                }

                if (cached instanceof CachedPrincipal) {
                    logger.debug("缓存命中: uid={}", uid);
                    // 转换为 UserInfo (仅包含权限相关字段)
                    return ((CachedPrincipal) cached).toUserInfo();
                }
            }

            // 2. 缓存未命中，查询数据库
            logger.debug("缓存未命中，查询数据库: uid={}", uid);
            UserInfo userInfo = userInfoMapper.getUserInfoByUid(uid);

            // 3. 写入缓存（仅缓存权限相关字段）
            if (userInfo != null) {
                CachedPrincipal cachedPrincipal = CachedPrincipal.fromUserInfo(userInfo);
                redisUtil.set(key, cachedPrincipal, CACHE_TTL_SECONDS);
                logger.debug("Principal 已缓存: uid={}, groups={}, roles={}, ttl={}s",
                        uid, userInfo.getGroupIds(), userInfo.getRoles(), CACHE_TTL_SECONDS);
            } else {
                // 缓存 NULL 值（防止缓存穿透）
                redisUtil.set(key, NULL_PLACEHOLDER, NULL_CACHE_TTL_SECONDS);
                logger.debug("Principal 不存在，缓存 NULL: uid={}, ttl={}s", uid, NULL_CACHE_TTL_SECONDS);
            }

            return userInfo;

        } catch (Exception e) {
            logger.error("获取 Principal 失败（降级到数据库查询）: uid={}, error={}", uid, e.getMessage());
            // 降级：直接查数据库
            return userInfoMapper.getUserInfoByUid(uid);
        }
    }

    /**
     * 刷新缓存（用户信息变更时）
     *
     * <p><strong>触发场景</strong>：
     * <ul>
     *   <li>用户修改密码</li>
     *   <li>用户组别变更（加入/移除组）</li>
     *   <li>用户角色变更</li>
     *   <li>管理员修改用户信息</li>
     * </ul>
     *
     * @param uid 用户 ID
     */
    public void refreshPrincipal(String uid) {
        if (uid == null || uid.trim().isEmpty()) {
            return;
        }

        String key = PRINCIPAL_KEY_PREFIX + uid;

        try {
            // 1. 查询最新数据
            UserInfo userInfo = userInfoMapper.getUserInfoByUid(uid);

            // 2. 更新缓存（仅缓存权限相关字段）
            if (userInfo != null) {
                CachedPrincipal cachedPrincipal = CachedPrincipal.fromUserInfo(userInfo);
                redisUtil.set(key, cachedPrincipal, CACHE_TTL_SECONDS);
                logger.info("Principal 缓存已刷新: uid={}, groups={}, roles={}",
                        uid, userInfo.getGroupIds(), userInfo.getRoles());
            } else {
                // 用户已删除，清除缓存
                evictPrincipal(uid);
            }

        } catch (Exception e) {
            logger.error("刷新 Principal 缓存失败: uid={}, error={}", uid, e.getMessage());
        }
    }

    /**
     * 清除缓存（用户删除或需要强制重新加载时）
     *
     * @param uid 用户 ID
     */
    public void evictPrincipal(String uid) {
        if (uid == null || uid.trim().isEmpty()) {
            return;
        }

        String key = PRINCIPAL_KEY_PREFIX + uid;

        try {
            redisUtil.del(key);
            logger.info("Principal 缓存已清除: uid={}", uid);
        } catch (Exception e) {
            logger.error("清除 Principal 缓存失败: uid={}, error={}", uid, e.getMessage());
        }
    }

    /**
     * 批量清除缓存（批量更新用户时）
     *
     * @param uids 用户 ID 列表
     */
    public void evictPrincipals(java.util.List<String> uids) {
        if (uids == null || uids.isEmpty()) {
            return;
        }

        for (String uid : uids) {
            evictPrincipal(uid);
        }

        logger.info("批量清除 Principal 缓存: count={}", uids.size());
    }

    /**
     * 预热缓存（批量加载用户到缓存）
     *
     * @param uids 用户 ID 列表
     */
    public void warmupCache(java.util.List<String> uids) {
        if (uids == null || uids.isEmpty()) {
            return;
        }

        int successCount = 0;
        for (String uid : uids) {
            try {
                UserInfo userInfo = userInfoMapper.getUserInfoByUid(uid);
                if (userInfo != null) {
                    String key = PRINCIPAL_KEY_PREFIX + uid;
                    CachedPrincipal cachedPrincipal = CachedPrincipal.fromUserInfo(userInfo);
                    redisUtil.set(key, cachedPrincipal, CACHE_TTL_SECONDS);
                    successCount++;
                }
            } catch (Exception e) {
                logger.warn("预热缓存失败: uid={}, error={}", uid, e.getMessage());
            }
        }

        logger.info("缓存预热完成: total={}, success={}", uids.size(), successCount);
    }

    /**
     * 获取缓存统计信息
     *
     * @return 缓存统计（用于监控）
     */
    public CacheStats getStats() {
        // TODO: 实现缓存命中率统计（需要额外的计数器）
        return new CacheStats();
    }

    /**
     * 缓存统计信息
     */
    public static class CacheStats {
        private long hitCount = 0;
        private long missCount = 0;
        private double hitRate = 0.0;

        public long getHitCount() {
            return hitCount;
        }

        public void setHitCount(long hitCount) {
            this.hitCount = hitCount;
        }

        public long getMissCount() {
            return missCount;
        }

        public void setMissCount(long missCount) {
            this.missCount = missCount;
        }

        public double getHitRate() {
            long total = hitCount + missCount;
            if (total == 0) return 0.0;
            return (double) hitCount / total * 100;
        }

        public void setHitRate(double hitRate) {
            this.hitRate = hitRate;
        }
    }
}
