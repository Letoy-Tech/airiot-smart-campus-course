package edu.campus.v2.caseflow;

/**
 * 事件当前状态不允许该动作（例如未分派就开始处理）：返回 409。
 * message 由 CaseService 的固定规则给出，不回显请求原文。
 */
public class CaseStateException extends RuntimeException {

    public CaseStateException(String message) {
        super(message);
    }
}
