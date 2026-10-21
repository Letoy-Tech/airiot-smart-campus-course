package com.letoy.main.campus.service;

/** Contains only a safe business message, never an upstream URL, response, or credential. */
public class CampusException extends RuntimeException {
    private final int status;
    private final String code;

    public CampusException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
    public int getStatus() { return status; }
    public String getCode() { return code; }
    public static CampusException badRequest(String message) {
        return new CampusException(400, "INVALID_REQUEST", message);
    }
    public static CampusException denied() {
        return new CampusException(403, "ACCESS_DENIED", "当前身份没有此校园操作权限");
    }
    public static CampusException upstream(String message) {
        return new CampusException(502, "UPSTREAM_UNAVAILABLE", message);
    }
}
