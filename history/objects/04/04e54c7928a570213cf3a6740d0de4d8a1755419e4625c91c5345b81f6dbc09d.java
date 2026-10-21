package edu.campus.v2.web;

import edu.campus.v2.auth.LoginSessionStore;
import edu.campus.v2.auth.LoginTokenGenerator;
import edu.campus.v2.auth.SessionAuthFilter;
import edu.campus.v2.user.AuthenticatedUser;
import edu.campus.v2.user.UserAuthenticationService;
import java.time.Duration;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 登录相关接口：POST /api/login、GET /api/me、POST /api/logout。
 * 身份与返回的用户名一律用 MySQL 查到的账号记录（规范写法），不用输入的大小写形式。
 * 不写请求日志：口令、Authorization、令牌都不进日志。
 */
@RestController
@RequestMapping("/api")
public class AuthController {

    /** 登录失败统一说法，不区分"用户不存在"和"口令错误"，避免被用来探测账号。 */
    private static final String LOGIN_FAILED = "用户名或口令不正确";

    private final UserAuthenticationService authenticationService;
    private final LoginSessionStore sessionStore;
    private final LoginTokenGenerator tokenGenerator;
    private final Duration sessionTtl;

    public AuthController(UserAuthenticationService authenticationService,
                          LoginSessionStore sessionStore,
                          LoginTokenGenerator tokenGenerator,
                          @Value("${campus.session.ttl-seconds:1800}") long sessionTtlSeconds) {
        this.authenticationService = authenticationService;
        this.sessionStore = sessionStore;
        this.tokenGenerator = tokenGenerator;
        this.sessionTtl = Duration.ofSeconds(sessionTtlSeconds);
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @RequestBody(required = false) LoginRequest request) {
        if (request == null || isBlank(request.username()) || isBlank(request.password())) {
            return loginFailed();
        }

        Optional<AuthenticatedUser> authenticated =
                authenticationService.authenticate(request.username(), request.password());
        if (authenticated.isEmpty()) {
            return loginFailed();
        }

        AuthenticatedUser user = authenticated.get();
        String token = tokenGenerator.newToken();
        // 写不进去就抛 SessionStoreUnavailableException → 503，不返回 token，不伪造成功
        sessionStore.save(token, user, sessionTtl);
        return ResponseEntity.ok(ApiResponse.ok(
                new LoginResponse(token, new UserView(user.username(), user.role()))));
    }

    @GetMapping("/me")
    public ApiResponse<UserView> me(
            @RequestAttribute(SessionAuthFilter.CURRENT_USER_ATTRIBUTE) AuthenticatedUser user) {
        return ApiResponse.ok(new UserView(user.username(), user.role()));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(
            @RequestAttribute(SessionAuthFilter.CURRENT_TOKEN_ATTRIBUTE) String token) {
        sessionStore.delete(token);
        return ApiResponse.ok(null);
    }

    private static ResponseEntity<ApiResponse<LoginResponse>> loginFailed() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(HttpStatus.UNAUTHORIZED.value(), LOGIN_FAILED, null));
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
