package edu.campus.course;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Configuration
public class SecurityConfiguration {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean UserDetailsService userDetailsService(AccountDirectory directory) {
        return username -> {
            var account = directory.find(username).orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
            return User.withUsername(account.username()).password(account.passwordHash())
                    .disabled(!account.enabled()).roles(account.roles().toArray(String[]::new)).build();
        };
    }

    static void respond(ObjectMapper mapper, HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json");
        response.setHeader("Cache-Control", "no-store");
        mapper.writeValue(response.getOutputStream(), status == 200 ? ApiResponse.ok(null) : ApiResponse.error(status, message));
    }

    @Bean SecurityFilterChain security(HttpSecurity http, AccountDirectory directory, ObjectMapper mapper) throws Exception {
        http.authorizeHttpRequests(auth -> auth
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                .requestMatchers(HttpMethod.GET, "/api/auth/csrf").permitAll()
                .requestMatchers("/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/campus/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/campus/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/campus/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/api/campus/**").hasRole("ADMIN")
                .requestMatchers("/api/campus/**").hasAnyRole("ADMIN", "CAMPUS_MANAGER", "CAMPUS_VIEWER")
                .requestMatchers("/api/**").authenticated().anyRequest().denyAll());
        http.exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, exception) -> respond(mapper, response, 401, "AUTHENTICATION_REQUIRED"))
                .accessDeniedHandler((request, response, exception) -> {
                    var authentication = SecurityContextHolder.getContext().getAuthentication();
                    boolean signedIn = authentication != null && authentication.isAuthenticated()
                            && !(authentication instanceof org.springframework.security.authentication.AnonymousAuthenticationToken);
                    respond(mapper, response, signedIn ? 403 : 401,
                            exception instanceof CsrfException ? "CSRF_INVALID" : "ACCESS_DENIED");
                }));
        // Keep Spring Security's standard CSRF repository and request handler.
        http.formLogin(login -> login.loginProcessingUrl("/api/auth/login")
                .successHandler((request, response, authentication) -> respond(mapper, response, 200, "ok"))
                .failureHandler((request, response, exception) -> respond(mapper, response, 401, "BAD_CREDENTIALS")));
        http.logout(logout -> logout.logoutUrl("/api/auth/logout").invalidateHttpSession(true)
                .clearAuthentication(true).deleteCookies("COURSESESSION")
                .logoutSuccessHandler((request, response, authentication) -> respond(mapper, response, 200, "ok")));
        http.sessionManagement(session -> session.sessionFixation(fixation -> fixation.changeSessionId()));
        http.requestCache(cache -> cache.disable());
        http.addFilterBefore(new OncePerRequestFilter() {
            @Override protected void doFilterInternal(jakarta.servlet.http.HttpServletRequest request,
                    HttpServletResponse response, jakarta.servlet.FilterChain chain) throws jakarta.servlet.ServletException, IOException {
                var authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()
                        && !(authentication instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)) {
                    var account = directory.find(authentication.getName());
                    if (account.isEmpty() || !account.get().enabled()) {
                        SecurityContextHolder.clearContext();
                        var session = request.getSession(false);
                        if (session != null) session.invalidate();
                        respond(mapper, response, 401, "IDENTITY_DISABLED");
                        return;
                    }
                    var current = account.get();
                    var authorities = current.roles().stream().sorted().map(role -> new SimpleGrantedAuthority("ROLE_" + role)).toList();
                    var refreshed = new UsernamePasswordAuthenticationToken(current.username(), null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(refreshed);
                }
                chain.doFilter(request, response);
            }
        }, AuthorizationFilter.class);
        return http.build();
    }
}
