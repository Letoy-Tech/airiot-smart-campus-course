package edu.campus.v2.space;

/**
 * 空间位置字段不合法（楼栋或楼层为空、超出列长度）。调用方必须把它变成 400。
 * message 只写字段规则，不回显请求原文，也不带任何身份信息。
 */
public class SpaceValidationException extends RuntimeException {

    public SpaceValidationException(String message) {
        super(message);
    }
}
