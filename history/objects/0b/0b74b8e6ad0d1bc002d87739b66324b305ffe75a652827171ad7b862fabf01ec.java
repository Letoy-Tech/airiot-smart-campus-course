package edu.campus.v2.web;

import edu.campus.v2.auth.SessionStoreUnavailableException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 统一处理两类问题：Redis 不可用（503）与请求体读不出来（400）。
 * 响应里的 message 都是固定文案，不回显异常内容，避免把口令等内容带出去。
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(SessionStoreUnavailableException.class)
    public ResponseEntity<ApiResponse<Void>> sessionStoreUnavailable(
            SessionStoreUnavailableException unavailable) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ApiResponse<>(HttpStatus.SERVICE_UNAVAILABLE.value(),
                        "会话服务暂时不可用，请稍后重试", null));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> unreadableBody(HttpMessageNotReadableException unreadable) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(HttpStatus.BAD_REQUEST.value(),
                        "请求体格式不正确", null));
    }
}
