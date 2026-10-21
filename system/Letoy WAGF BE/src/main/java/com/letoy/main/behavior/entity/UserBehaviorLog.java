package com.letoy.main.behavior.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserBehaviorLog {

    private String id;
    private String traceId;
    private String uid;
    private String username;
    private String requestMethod;
    private String requestUri;
    private String queryString;
    private String requestTarget;
    private String clientIp;
    private String userAgent;
    private String platform;
    private String appVersion;
    private String outcome;
    private String riskLevel;
    private Integer httpStatus;
    private Integer businessCode;
    private String errorMessage;
    private Long durationMs;
    private LocalDateTime createdAt;
}
