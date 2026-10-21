package com.letoy.main.behavior.support;

import jakarta.servlet.http.HttpServletRequest;

public final class UserBehaviorLogContext {

    public static final String ATTR_TRACE_ID = "behaviorLog.traceId";
    public static final String ATTR_OUTCOME = "behaviorLog.outcome";
    public static final String ATTR_RISK_LEVEL = "behaviorLog.riskLevel";
    public static final String ATTR_HTTP_STATUS = "behaviorLog.httpStatus";
    public static final String ATTR_BUSINESS_CODE = "behaviorLog.businessCode";
    public static final String ATTR_ERROR_MESSAGE = "behaviorLog.errorMessage";
    public static final String ATTR_UID = "behaviorLog.uid";
    public static final String ATTR_USERNAME = "behaviorLog.username";

    public static final String OUTCOME_SUCCESS = "SUCCESS";
    public static final String OUTCOME_AUTH_FAILURE = "AUTH_FAILURE";
    public static final String OUTCOME_ACCESS_DENIED = "ACCESS_DENIED";
    public static final String OUTCOME_RATE_LIMITED = "RATE_LIMITED";
    public static final String OUTCOME_BAD_REQUEST = "BAD_REQUEST";
    public static final String OUTCOME_SYSTEM_ERROR = "SYSTEM_ERROR";

    public static final String RISK_NORMAL = "NORMAL";
    public static final String RISK_SUSPICIOUS = "SUSPICIOUS";
    public static final String RISK_ERROR = "ERROR";

    private UserBehaviorLogContext() {
    }

    public static void markSuccess(HttpServletRequest request) {
        request.setAttribute(ATTR_OUTCOME, OUTCOME_SUCCESS);
        request.setAttribute(ATTR_RISK_LEVEL, RISK_NORMAL);
    }

    public static void mark(HttpServletRequest request,
                            String outcome,
                            String riskLevel,
                            Integer httpStatus,
                            Integer businessCode,
                            String errorMessage) {
        request.setAttribute(ATTR_OUTCOME, outcome);
        request.setAttribute(ATTR_RISK_LEVEL, riskLevel);
        if (httpStatus != null) {
            request.setAttribute(ATTR_HTTP_STATUS, httpStatus);
        }
        if (businessCode != null) {
            request.setAttribute(ATTR_BUSINESS_CODE, businessCode);
        }
        if (errorMessage != null) {
            request.setAttribute(ATTR_ERROR_MESSAGE, errorMessage);
        }
    }
}
