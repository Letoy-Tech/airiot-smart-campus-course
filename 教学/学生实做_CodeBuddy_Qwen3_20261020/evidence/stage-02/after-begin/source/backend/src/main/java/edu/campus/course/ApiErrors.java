package edu.campus.course;

import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(ApiFailure.class)
    ResponseEntity<ApiResponse<Void>> business(ApiFailure e) {
        return ResponseEntity.status(e.status).body(ApiResponse.error(e.status, e.getMessage()));
    }

    @ExceptionHandler({
        HttpMessageNotReadableException.class,
        MethodArgumentTypeMismatchException.class
    })
    ResponseEntity<ApiResponse<Void>> invalid(Exception e) {
        return business(ApiFailure.bad());
    }

    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<ApiResponse<Void>> duplicate(Exception e) {
        return business(new ApiFailure(409, "DUPLICATE_NAME"));
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ApiResponse<Void>> database(Exception e) {
        return business(new ApiFailure(500, "PERSISTENCE_FAILED"));
    }
}
