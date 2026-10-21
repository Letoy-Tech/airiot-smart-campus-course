package edu.campus.v2.owner;

/**
 * 提交的 expectedVersion 落后于库里记录的当前版本。
 * 调用方必须返回 409 并要求重新读取，绝不能覆盖新记录，也不能自动重发。
 */
public class OwnerVersionConflictException extends RuntimeException {

    public OwnerVersionConflictException() {
        super("负责人记录已被其他人更新，请重新读取后再决定");
    }
}
