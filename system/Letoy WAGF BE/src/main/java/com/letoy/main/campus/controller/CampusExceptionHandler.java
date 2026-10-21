package com.letoy.main.campus.controller;

import com.letoy.main.behavior.support.UserBehaviorLogContext;
import com.letoy.main.campus.airiot.AiriotException;
import com.letoy.main.campus.service.CampusException;
import com.letoy.main.common.dto.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(basePackageClasses = CampusController.class)
public class CampusExceptionHandler {
    @ExceptionHandler(CampusException.class)
    public ResponseEntity<ApiResponse<Void>> campus(HttpServletRequest request, CampusException exception) {
        return error(request, exception.getStatus(), exception.getCode(), exception.getMessage());
    }
    @ExceptionHandler(AiriotException.class)
    public ResponseEntity<ApiResponse<Void>> upstream(HttpServletRequest request, AiriotException exception) {
        // Upstream authentication can never invalidate the user's MG session.
        int status = exception.getHttpStatus() == 401 || exception.getHttpStatus() == 403 ? 502 : exception.getHttpStatus();
        return error(request, status, exception.getCode(), exception.getMessage());
    }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> unreadable(HttpServletRequest request) {
        return error(request, 400, "INVALID_JSON", "请求 JSON 格式或字段类型无效");
    }
    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class,
            MethodArgumentNotValidException.class})
    public ResponseEntity<ApiResponse<Void>> invalidParameter(HttpServletRequest request) {
        return error(request, 400, "INVALID_REQUEST", "请求参数缺失或格式无效");
    }
    private ResponseEntity<ApiResponse<Void>> error(HttpServletRequest request, int status, String code, String message) {
        int businessCode = status == 403 ? 2001 : status == 401 ? 1001 : status >= 500 ? 5200 : status == 409 ? 3409 : 3400;
        UserBehaviorLogContext.mark(request, status == 403 ? UserBehaviorLogContext.OUTCOME_ACCESS_DENIED
                        : status >= 500 ? UserBehaviorLogContext.OUTCOME_SYSTEM_ERROR : UserBehaviorLogContext.OUTCOME_BAD_REQUEST,
                status >= 500 ? UserBehaviorLogContext.RISK_ERROR : UserBehaviorLogContext.RISK_SUSPICIOUS,
                status, businessCode, code);
        return ResponseEntity.status(status).body(ApiResponse.<Void>error(status, businessCode, message).path(request.getRequestURI()));
    }
}
