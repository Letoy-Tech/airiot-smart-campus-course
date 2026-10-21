package com.letoy.main.behavior.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.letoy.main.behavior.config.UserBehaviorLogProperties;
import com.letoy.main.behavior.entity.UserBehaviorLog;
import com.letoy.main.behavior.service.UserBehaviorLogPersistenceService;
import com.letoy.main.behavior.service.UserBehaviorLogService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserBehaviorLogServiceImpl implements UserBehaviorLogService {

    private static final Logger logger = LoggerFactory.getLogger(UserBehaviorLogServiceImpl.class);

    private final UserBehaviorLogProperties properties;
    private final UserBehaviorLogPersistenceService persistenceService;
    private final ObjectMapper objectMapper;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @Override
    @Async("applicationTaskExecutor")
    public void record(UserBehaviorLog log) {
        if (log == null || !properties.isEnabled()) {
            return;
        }

        if (!properties.isProducerEnabled()) {
            persistFallback(log, null);
            return;
        }

        try {
            String payload = objectMapper.writeValueAsString(log);
            kafkaTemplate.send(properties.getTopic(), buildMessageKey(log), payload)
                    .whenComplete((result, throwable) -> {
                        if (throwable != null) {
                            persistFallback(log, throwable);
                        }
                    });
        } catch (JsonProcessingException exception) {
            persistFallback(log, exception);
        }
    }

    private String buildMessageKey(UserBehaviorLog log) {
        if (log.getUid() != null && !log.getUid().isBlank()) {
            return log.getUid();
        }
        return log.getClientIp();
    }

    private void persistFallback(UserBehaviorLog log, Throwable throwable) {
        if (throwable != null) {
            logger.warn("User behavior log Kafka dispatch failed, falling back to DB persistence: id={}", log.getId(), throwable);
        }
        if (properties.isDirectFallbackEnabled()) {
            persistenceService.persist(log);
        }
    }
}
