package edu.campus.v2.auth;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 只把角色拦截器挂到 /api/** 上；会话校验由 SessionAuthFilter 负责。
 */
@Configuration
public class AuthWebConfig implements WebMvcConfigurer {

    private final RoleInterceptor roleInterceptor;

    public AuthWebConfig(RoleInterceptor roleInterceptor) {
        this.roleInterceptor = roleInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(roleInterceptor).addPathPatterns("/api/**");
    }
}
