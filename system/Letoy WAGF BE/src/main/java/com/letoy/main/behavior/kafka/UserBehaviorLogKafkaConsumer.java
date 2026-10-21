package com.letoy.main.behavior.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.letoy.main.behavior.config.UserBehaviorLogProperties;
import com.letoy.main.behavior.entity.UserBehaviorLog;
import com.letoy.main.behavior.service.UserBehaviorLogPersistenceService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "behavior.log", name = "consumer-enabled", havingValue = "true", matchIfMissing = true)
public class UserBehaviorLogKafkaConsumer {

    private static final Logger logger = LoggerFactory.getLogger(UserBehaviorLogKafkaConsumer.class);

    private final ObjectMapper objectMapper;
    private final UserBehaviorLogPersistenceService persistenceService;
    private final UserBehaviorLogProperties properties;

    @KafkaListener(
            topics = "#{@userBehaviorLogProperties.topic}",
            groupId = "#{@userBehaviorLogProperties.consumerGroup}",
            autoStartup = "#{@userBehaviorLogProperties.consumerEnabled}"
    )
    public void consume(String payload) {
        try {
            UserBehaviorLog log = objectMapper.readValue(payload, UserBehaviorLog.class);
            persistenceService.persist(log);
        } catch (Exception exception) {
            logger.error("Failed to consume user behavior log payload from topic {}", properties.getTopic(), exception);
        }
    }
}
