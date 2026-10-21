package edu.campus.v2.owner;

/**
 * 责任登记字段不合法（负责人为空或账号不存在、备注为空或超长、版本号无效）。
 * 调用方必须返回 400；message 只写字段规则，不回显请求原文。
 */
public class OwnerValidationException extends RuntimeException {

    public OwnerValidationException(String message) {
        super(message);
    }
}
