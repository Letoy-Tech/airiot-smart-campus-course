package cn.campus.course;

import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.HttpRequestMethodNotSupportedException;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(ApiException.class)
    ResponseEntity<Api<Void>> known(ApiException e) {
        return error(e.status(), e.getMessage());
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    ResponseEntity<Api<Void>> invalid(Exception e) {
        return error(400, "请检查输入：必填内容、长度和版本号必须符合要求");
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<Api<Void>> storage(DataAccessException e) {
        return error(503, "数据库或登录服务暂时不可用，请检查本课程 MySQL 和 Redis");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<Api<Void>> missing(NoResourceFoundException e) {
        return error(404, "没有找到这个接口");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<Api<Void>> method(HttpRequestMethodNotSupportedException e) {
        return error(405, "这个接口不支持该操作");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Api<Void>> unexpected(Exception e) {
        return error(500, "后端处理失败，请在后端终端检查错误并联系教师");
    }

    private ResponseEntity<Api<Void>> error(int status, String message) {
        return ResponseEntity.status(status).body(new Api<>(status, message, null));
    }
}
