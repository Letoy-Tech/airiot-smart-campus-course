package edu.campus.v2.caseflow;

/**
 * 演练事件字段不合法：空内容、超长或缺少设备编号。
 * message 由 CaseService 的固定字段规则给出，不含请求原文。
 */
public class CaseValidationException extends RuntimeException {

    public CaseValidationException(String message) {
        super(message);
    }
}
