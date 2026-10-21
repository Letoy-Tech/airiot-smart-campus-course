package cn.campus.course;

public record Api<T>(int code, String message, T data) {
    public static <T> Api<T> ok(T data) {
        return new Api<>(0, "ok", data);
    }
}
