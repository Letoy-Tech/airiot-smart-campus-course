package edu.campus.v2.caseflow;

/**
 * 提交的 expectedVersion 与当前版本不一致，或条件更新没有命中：
 * 返回 409，不覆盖别人刚写入的记录，也不自动重试。
 */
public class CaseVersionConflictException extends RuntimeException {

    public CaseVersionConflictException() {
        super("演练事件已被其他人更新，请重新读取后再决定");
    }
}
