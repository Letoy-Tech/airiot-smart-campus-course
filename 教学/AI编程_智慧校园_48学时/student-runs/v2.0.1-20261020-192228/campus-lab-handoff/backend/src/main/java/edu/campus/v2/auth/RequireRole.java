package edu.campus.v2.auth;

import edu.campus.v2.user.Role;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标记某个接口允许哪些角色：已登录但角色不符时返回 403。
 * 可写在方法上，也可写在控制器类上（方法上的优先）。
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequireRole {

    Role[] value();
}
