package edu.campus.v2.space;

/**
 * 要修改的空间不在 spaces 表中。调用方必须把它变成 404，
 * 不能用“更新成功”或“创建新空间”顶替。
 */
public class SpaceNotFoundException extends RuntimeException {

    private final String id;

    public SpaceNotFoundException(String id) {
        super("找不到该空间");
        this.id = id;
    }

    /** 仅用于日志排查，不进入响应体。 */
    public String id() {
        return id;
    }
}
