package edu.campus.v2.caseflow;

/**
 * 当前登录角色或事件归属不允许执行该动作：返回 403，不读取也不写入目标事件。
 */
public class CaseActionForbiddenException extends RuntimeException {

    public CaseActionForbiddenException() {
        super("已登录但无权执行该事件动作");
    }
}
