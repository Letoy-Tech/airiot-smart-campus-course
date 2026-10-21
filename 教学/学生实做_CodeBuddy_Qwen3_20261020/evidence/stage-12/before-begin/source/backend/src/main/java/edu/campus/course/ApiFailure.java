package edu.campus.course;

public class ApiFailure extends RuntimeException {
    public final int status;

    public ApiFailure(int status, String message) {
        super(message);
        this.status = status;
    }

    public static ApiFailure bad() {
        return new ApiFailure(400, "INVALID_REQUEST");
    }

    public static ApiFailure missing() {
        return new ApiFailure(404, "NOT_FOUND");
    }

    public static ApiFailure state() {
        return new ApiFailure(409, "STATE_CONFLICT");
    }

    public static void version(long expected, long actual) {
        if (expected != actual) throw new ApiFailure(409, "VERSION_CONFLICT");
    }
}
