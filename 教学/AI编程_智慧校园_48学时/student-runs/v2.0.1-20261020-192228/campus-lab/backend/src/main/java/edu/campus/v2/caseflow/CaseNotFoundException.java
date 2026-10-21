package edu.campus.v2.caseflow;

/**
 * 请求的演练事件不存在：返回 404，不创建、不更新任何记录。
 */
public class CaseNotFoundException extends RuntimeException {

    public CaseNotFoundException(String id) {
        super("找不到演练事件：" + id);
    }
}
