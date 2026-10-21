package com.letoy.main.campus.airiot;

/** Safe boundary error: never attach an upstream body, URL, token or transport cause. */
public final class AiriotException extends RuntimeException {
    private final String code;
    private final int httpStatus;

    public AiriotException(String code, int httpStatus, String safeMessage) {
        super(safeMessage);
        this.code = code;
        this.httpStatus = httpStatus;
    }

    public String getCode() { return code; }
    public int getHttpStatus() { return httpStatus; }
}
