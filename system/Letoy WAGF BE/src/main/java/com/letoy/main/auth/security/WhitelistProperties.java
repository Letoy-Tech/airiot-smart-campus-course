package com.letoy.main.auth.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@ConfigurationProperties(prefix = "whitelist")
public class WhitelistProperties {

    private Boolean strictMode = false;
    private Boolean allowBusinessApis = false;
    private List<String> coreWhitelist = new ArrayList<>(List.of(
            "/swagger-ui.html",
            "/swagger-ui/**",
            "/webjars/**",
            "/v3/api-docs/**",
            "/swagger-resources/**",
            "/actuator/health",
            "/aliyun/captcha/verify",
            "/auth/login/phone-code/send",
            "/auth/login/phone-code",
            "/auth/bootstrap",
            "/auth/login",
            "/auth/refresh"
    ));

    public List<String> getEffectiveWhitelist() {
        return new ArrayList<>(coreWhitelist);
    }

    public Boolean getStrictMode() {
        return strictMode;
    }

    public void setStrictMode(Boolean strictMode) {
        this.strictMode = strictMode;
    }

    public Boolean getAllowBusinessApis() {
        return allowBusinessApis;
    }

    public void setAllowBusinessApis(Boolean allowBusinessApis) {
        this.allowBusinessApis = allowBusinessApis;
    }

    public List<String> getCoreWhitelist() {
        return coreWhitelist;
    }

    public void setCoreWhitelist(List<String> coreWhitelist) {
        this.coreWhitelist = coreWhitelist;
    }
}
