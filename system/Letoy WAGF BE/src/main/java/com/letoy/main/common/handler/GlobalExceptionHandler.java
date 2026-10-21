package com.letoy.main.common.handler;

import com.letoy.main.behavior.support.UserBehaviorLogContext;
import com.letoy.main.common.dto.ApiResponse;
import com.letoy.main.common.enums.ErrorCode;
import com.letoy.main.common.exception.MyAuthenticationException;
import com.letoy.main.common.exception.RequestLimitException;
import com.letoy.main.common.exception.SystemException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.retry.NonTransientAiException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.validation.ConstraintViolationException;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.SQLException;
import java.util.UUID;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(RequestLimitException.class)
    public ResponseEntity<ApiResponse<Void>> handleRequestLimit(HttpServletRequest request, RequestLimitException exception) {
        return build(request, ErrorCode.AUTHZ_RATE_LIMIT_EXCEEDED, exception.getMessage(), exception);
    }

    @ExceptionHandler(MyAuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthentication(HttpServletRequest request, MyAuthenticationException exception) {
        return build(request, ErrorCode.AUTH_TOKEN_INVALID, exception.getMessage(), exception);
    }

    @ExceptionHandler(SystemException.class)
    public ResponseEntity<ApiResponse<Void>> handleSystem(HttpServletRequest request, SystemException exception) {
        return build(request, ErrorCode.SYSTEM_INTERNAL_ERROR, exception.getMessage(), exception);
    }

    @ExceptionHandler(NonTransientAiException.class)
    public ResponseEntity<ApiResponse<Void>> handleAiUpstream(HttpServletRequest request, NonTransientAiException exception) {
        String message = "AI upstream request failed";
        Throwable rootCause = rootCause(exception);
        if (rootCause instanceof RestClientResponseException restException) {
            String responseBody = abbreviate(restException.getResponseBodyAsString(), 200);
            message = "AI upstream request failed (status=" + restException.getStatusCode().value() + ")";
            if (responseBody != null && !responseBody.isBlank()) {
                message += ": " + responseBody;
            }
        } else if (exception.getMessage() != null && !exception.getMessage().isBlank()) {
            message = "AI upstream request failed: " + exception.getMessage();
        }
        return build(request, ErrorCode.SYSTEM_NETWORK_ERROR, message, exception);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(HttpServletRequest request, IllegalArgumentException exception) {
        return build(request, ErrorCode.REQUEST_PARAMETER_INVALID, exception.getMessage(), exception);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodArgumentNotValid(HttpServletRequest request,
                                                                          MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getDefaultMessage() == null ? error.getField() + " is invalid" : error.getDefaultMessage())
                .orElse("Request body validation failed");
        return build(request, ErrorCode.REQUEST_PARAMETER_INVALID, message, exception);
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<ApiResponse<Void>> handleBindException(HttpServletRequest request, BindException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getDefaultMessage() == null ? error.getField() + " is invalid" : error.getDefaultMessage())
                .orElse("Request binding failed");
        return build(request, ErrorCode.REQUEST_PARAMETER_INVALID, message, exception);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolation(HttpServletRequest request,
                                                                       ConstraintViolationException exception) {
        String message = exception.getConstraintViolations().stream()
                .findFirst()
                .map(violation -> violation.getMessage())
                .orElse("Constraint validation failed");
        return build(request, ErrorCode.REQUEST_PARAMETER_INVALID, message, exception);
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingHeader(HttpServletRequest request, MissingRequestHeaderException exception) {
        return build(request, ErrorCode.REQUEST_HEADER_MISSING, exception.getHeaderName() + " is required", exception);
    }

    @ExceptionHandler({DataAccessException.class, SQLException.class})
    public ResponseEntity<ApiResponse<Void>> handleDatabase(HttpServletRequest request, Exception exception) {
        return build(request, ErrorCode.SYSTEM_DATABASE_ERROR, "Database operation failed", exception);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleFallback(HttpServletRequest request, Exception exception) {
        return build(request, ErrorCode.SYSTEM_UNEXPECTED_ERROR, "Unexpected server error", exception);
    }

    private ResponseEntity<ApiResponse<Void>> build(HttpServletRequest request,
                                                    ErrorCode errorCode,
                                                    String message,
                                                    Exception exception) {
        String traceId = UUID.randomUUID().toString();
        UserBehaviorLogContext.mark(
                request,
                resolveOutcome(errorCode),
                resolveRiskLevel(errorCode),
                errorCode.getHttpStatusValue(),
                errorCode.getCode(),
                message
        );
        request.setAttribute(UserBehaviorLogContext.ATTR_TRACE_ID, traceId);
        logger.error("[{}] {} {} -> {}", traceId, request.getMethod(), request.getRequestURI(), message, exception);
        ApiResponse<Void> response = ApiResponse.<Void>error(errorCode, message)
                .path(request.getRequestURI())
                .traceId(traceId);
        return ResponseEntity.status(errorCode.getHttpStatus()).body(response);
    }

    private Throwable rootCause(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current;
    }

    private String abbreviate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength) + "...";
    }

    private String resolveOutcome(ErrorCode errorCode) {
        if (errorCode.isAuthError()) {
            return UserBehaviorLogContext.OUTCOME_AUTH_FAILURE;
        }
        if (errorCode == ErrorCode.AUTHZ_ACCESS_DENIED) {
            return UserBehaviorLogContext.OUTCOME_ACCESS_DENIED;
        }
        if (errorCode == ErrorCode.AUTHZ_RATE_LIMIT_EXCEEDED) {
            return UserBehaviorLogContext.OUTCOME_RATE_LIMITED;
        }
        if (errorCode.isSystemError()) {
            return UserBehaviorLogContext.OUTCOME_SYSTEM_ERROR;
        }
        return UserBehaviorLogContext.OUTCOME_BAD_REQUEST;
    }

    private String resolveRiskLevel(ErrorCode errorCode) {
        if (errorCode.isSystemError()) {
            return UserBehaviorLogContext.RISK_ERROR;
        }
        if (errorCode.isSuccess()) {
            return UserBehaviorLogContext.RISK_NORMAL;
        }
        return UserBehaviorLogContext.RISK_SUSPICIOUS;
    }
}
