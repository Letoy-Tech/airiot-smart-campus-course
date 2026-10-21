package com.letoy.main.behavior.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "behavior.log")
public class UserBehaviorLogProperties {

    private boolean enabled = true;
    private boolean producerEnabled = true;
    private boolean consumerEnabled = true;
    private boolean directFallbackEnabled = true;
    private String topic = "user-behavior-log";
    private String consumerGroup = "letoy-wagf-behavior-log";
    private int maxRequestTargetLength = 512;
    private int maxQueryStringLength = 255;
    private int maxUserAgentLength = 512;
    private int maxErrorMessageLength = 255;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isProducerEnabled() {
        return producerEnabled;
    }

    public void setProducerEnabled(boolean producerEnabled) {
        this.producerEnabled = producerEnabled;
    }

    public boolean isConsumerEnabled() {
        return consumerEnabled;
    }

    public void setConsumerEnabled(boolean consumerEnabled) {
        this.consumerEnabled = consumerEnabled;
    }

    public boolean isDirectFallbackEnabled() {
        return directFallbackEnabled;
    }

    public void setDirectFallbackEnabled(boolean directFallbackEnabled) {
        this.directFallbackEnabled = directFallbackEnabled;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic;
    }

    public String getConsumerGroup() {
        return consumerGroup;
    }

    public void setConsumerGroup(String consumerGroup) {
        this.consumerGroup = consumerGroup;
    }

    public int getMaxRequestTargetLength() {
        return maxRequestTargetLength;
    }

    public void setMaxRequestTargetLength(int maxRequestTargetLength) {
        this.maxRequestTargetLength = maxRequestTargetLength;
    }

    public int getMaxQueryStringLength() {
        return maxQueryStringLength;
    }

    public void setMaxQueryStringLength(int maxQueryStringLength) {
        this.maxQueryStringLength = maxQueryStringLength;
    }

    public int getMaxUserAgentLength() {
        return maxUserAgentLength;
    }

    public void setMaxUserAgentLength(int maxUserAgentLength) {
        this.maxUserAgentLength = maxUserAgentLength;
    }

    public int getMaxErrorMessageLength() {
        return maxErrorMessageLength;
    }

    public void setMaxErrorMessageLength(int maxErrorMessageLength) {
        this.maxErrorMessageLength = maxErrorMessageLength;
    }
}
