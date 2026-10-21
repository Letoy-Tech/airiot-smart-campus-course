package edu.campus.v2.auth;

/**
 * Redis 会话服务不可用（连不上、超时、认证失败等）。
 * 调用方必须把它变成 503，不能当成"未登录"以外的任何宽松结果，更不能伪造登录成功。
 */
public class SessionStoreUnavailableException extends RuntimeException {

    public SessionStoreUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
