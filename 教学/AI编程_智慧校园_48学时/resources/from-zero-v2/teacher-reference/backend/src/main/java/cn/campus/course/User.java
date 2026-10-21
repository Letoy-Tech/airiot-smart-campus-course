package cn.campus.course;

public record User(String username, String role) {
    public void requireAdmin() {
        if (!"ADMIN".equals(role)) {
            throw new ApiException(403, "这个操作需要管理员账户");
        }
    }

    public void requireHandler(String assignee) {
        if ("ADMIN".equals(role)) {
            return;
        }
        if (!"MANAGER".equals(role) || !username.equals(assignee)) {
            throw new ApiException(403, "管理人员只能处理分派给自己的事件；查看者不能修改");
        }
    }
}
