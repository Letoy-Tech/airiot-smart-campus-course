package com.letoy.main.common.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * Redis 配置
 *
 * <p><strong>Phase 3: 权限缓存升级 - 双模板方案</strong>
 * <ul>
 *   <li><strong>myRedisTemplate</strong>: 用于对象存储(UserInfo等),带类型信息</li>
 *   <li><strong>stringRedisTemplate</strong>: 用于纯字符串存储(API规则等),无类型信息</li>
 * </ul>
 *
 * <p><strong>使用场景</strong>:
 * <ul>
 *   <li>UserInfo 缓存 → myRedisTemplate (对象序列化 + @class)</li>
 *   <li>API 规则缓存 → stringRedisTemplate (纯字符串)</li>
 * </ul>
 *
 * @since 2026-01-04 (Phase 3 升级)
 */
@Configuration
public class RedisConfig {

    /**
     * 对象存储模板 - 用于 UserInfo 等复杂对象
     *
     * 特性:
     * - 支持对象序列化
     * - 添加 @class 类型信息
     * - 支持 LocalDateTime 等 Java 8 时间类型
     */
    @Bean(name = "myRedisTemplate")
    public RedisTemplate<Object, Object> redisTemplate(RedisConnectionFactory redisConnectionFactory)  {
        RedisTemplate<Object, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(redisConnectionFactory);

        // Key 序列化：String
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());

        // Value 序列化：JSON with type info
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY
        );

        GenericJackson2JsonRedisSerializer jsonSerializer =
                new GenericJackson2JsonRedisSerializer(objectMapper);

        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet();
        return template;
    }

    /**
     * 字符串存储模板 - 用于 API 规则等纯字符串数据
     *
     * 特性:
     * - 纯字符串序列化
     * - 不添加类型信息
     * - 兼容手动添加的 JSON 数据
     */
    @Bean(name = "apiRuleRedisTemplate")
    public RedisTemplate<String, String> apiRuleRedisTemplate(RedisConnectionFactory redisConnectionFactory) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(redisConnectionFactory);

        // 全部使用 String 序列化器
        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        template.setKeySerializer(stringSerializer);
        template.setValueSerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);
        template.setHashValueSerializer(stringSerializer);

        template.afterPropertiesSet();
        return template;
    }

}