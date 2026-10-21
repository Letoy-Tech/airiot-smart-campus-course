package com.letoy.main.common.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * 异步任务配置 - Phase 5: 埋点异步化 + API 规则同步异步化
 *
 * <p><strong>线程池参数</strong>：
 * <ul>
 *   <li>核心线程数：2（低负载时保持的线程数）</li>
 *   <li>最大线程数：10（高负载时最多创建的线程数）</li>
 *   <li>队列容量：500（待处理任务队列大小）</li>
 *   <li>拒绝策略：CallerRunsPolicy（队列满时由调用线程执行）</li>
 * </ul>
 *
 * <p><strong>降级策略</strong>：
 * <ul>
 *   <li>当队列满时，使用 CallerRunsPolicy（由主线程执行）</li>
 *   <li>这会降低性能，但保证埋点不丢失</li>
 *   <li>如果更关注性能，可改为 DiscardOldestPolicy（丢弃最旧的任务）</li>
 * </ul>
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 5)
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    private static final Logger logger = LoggerFactory.getLogger(AsyncConfig.class);

    @Bean(name = "applicationTaskExecutor")
    public Executor applicationTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // 核心线程数
        executor.setCorePoolSize(2);

        // 最大线程数
        executor.setMaxPoolSize(10);

        // 队列容量
        executor.setQueueCapacity(500);

        // 线程名称前缀
        executor.setThreadNamePrefix("app-task-");

        // 线程空闲时间（秒）
        executor.setKeepAliveSeconds(60);

        // 拒绝策略：队列满时由调用线程执行（保证不丢失）
        // 如果更关注性能，可改为：executor.setRejectedExecutionHandler(new ThreadPoolExecutor.DiscardOldestPolicy());
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());

        // 等待任务完成后再关闭线程池
        executor.setWaitForTasksToCompleteOnShutdown(true);

        // 等待时间（秒）
        executor.setAwaitTerminationSeconds(60);

        executor.initialize();

        logger.info("Application task executor initialized: corePoolSize=2, maxPoolSize=10, queueCapacity=500");

        return executor;
    }

    /**
     * API 规则同步线程池
     * 用于异步同步 API 规则到 Redis，避免阻塞主请求
     */
    @Bean(name = "apiRuleSyncExecutor")
    public Executor apiRuleSyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // 核心线程数（API 规则同步频率较低，1 个核心线程足够）
        executor.setCorePoolSize(1);

        // 最大线程数
        executor.setMaxPoolSize(3);

        // 队列容量（较小，因为同步操作会合并）
        executor.setQueueCapacity(50);

        // 线程名称前缀
        executor.setThreadNamePrefix("api-rule-sync-");

        // 线程空闲时间（秒）
        executor.setKeepAliveSeconds(60);

        // 拒绝策略：丢弃最旧的任务（因为新的同步会包含所有数据）
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.DiscardOldestPolicy());

        // 等待任务完成后再关闭线程池
        executor.setWaitForTasksToCompleteOnShutdown(true);

        // 等待时间（秒）
        executor.setAwaitTerminationSeconds(30);

        executor.initialize();

        logger.info("API 规则同步线程池已初始化: corePoolSize=1, maxPoolSize=3, queueCapacity=50");

        return executor;
    }
}
