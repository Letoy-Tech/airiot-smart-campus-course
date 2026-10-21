package edu.campus.course;

import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
public class AuthController {
    private final AccountDirectory accounts;
    public AuthController(AccountDirectory accounts) { this.accounts = accounts; }
    record CsrfView(String token, String headerName) { }
    record Identity(String uid, String username, String displayName, List<String> roles, String source) { }

    @GetMapping("/api/auth/csrf")
    public ApiResponse<CsrfView> csrf(CsrfToken token) {
        return ApiResponse.ok(new CsrfView(token.getToken(), token.getHeaderName()));
    }
    @GetMapping("/api/auth/me")
    public ApiResponse<Identity> me(Authentication authentication) {
        var account = accounts.find(authentication.getName()).orElseThrow();
        return ApiResponse.ok(new Identity(account.username(), account.username(), account.displayName(),
                account.roles().stream().sorted().toList(), "TEACHING_MOCK"));
    }
}
