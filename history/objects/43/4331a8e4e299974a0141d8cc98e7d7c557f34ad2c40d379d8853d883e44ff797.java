package edu.campus.v2.web;

import edu.campus.v2.auth.SessionStoreUnavailableException;
import edu.campus.v2.owner.DeviceNotFoundException;
import edu.campus.v2.owner.OwnerValidationException;
import edu.campus.v2.owner.OwnerVersionConflictException;
import edu.campus.v2.space.SpaceNotFoundException;
import edu.campus.v2.space.SpaceValidationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 统一处理可预期的失败：Redis 不可用（503）、请求体读不出来（400）、
 * 空间不存在（404）、空间字段不合法（400）。
 * 响应里的 message 都是固定文案或字段规则，不回显异常内容、请求原文或身份信息。
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

    @ExceptionHandler(SpaceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> spaceNotFound(SpaceNotFoundException notFound) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiResponse<>(HttpStatus.NOT_FOUND.value(),
                        "找不到该空间", null));
    }

    /** message 来自 SpaceService 的固定字段规则，不含请求原文。 */
    @ExceptionHandler(SpaceValidationException.class)
    public ResponseEntity<ApiResponse<Void>> spaceInvalid(SpaceValidationException invalid) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(HttpStatus.BAD_REQUEST.value(),
                        invalid.getMessage(), null));
    }

    @ExceptionHandler(DeviceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> deviceNotFound(DeviceNotFoundException notFound) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiResponse<>(HttpStatus.NOT_FOUND.value(),
                        "找不到该设备", null));
    }

    /** 版本落后：返回 409，要求重新读取后再决定；不覆盖库里更新的记录。 */
    @ExceptionHandler(OwnerVersionConflictException.class)
    public ResponseEntity<ApiResponse<Void>> ownerVersionConflict(OwnerVersionConflictException conflict) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiResponse<>(HttpStatus.CONFLICT.value(),
                        "负责人记录已被其他人更新，请重新读取后再决定", null));
    }

    /** message 来自 OwnerService 的固定字段规则，不含请求原文。 */
    @ExceptionHandler(OwnerValidationException.class)
    public ResponseEntity<ApiResponse<Void>> ownerInvalid(OwnerValidationException invalid) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(HttpStatus.BAD_REQUEST.value(),
                        invalid.getMessage(), null));
    }
}
