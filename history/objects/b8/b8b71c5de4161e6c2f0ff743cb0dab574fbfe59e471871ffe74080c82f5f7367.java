package edu.campus.course;

import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Component
public class LocalAccountDirectory implements AccountDirectory {
    private final Map<String, Account> accounts;
    public LocalAccountDirectory(Environment environment, PasswordEncoder encoder) {
        Map<String, Account> values = new LinkedHashMap<>();
        for (String username : new String[]{"admin", "manager-a", "manager-b", "viewer"}) {
            String password = environment.getProperty("course.passwords." + username);
            if (password == null || password.isBlank()) {
                throw new IllegalStateException("Missing required external teaching password for " + username);
            }
            // BCrypt has a 72-byte input boundary; reject instead of silently truncating.
            if (password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
                throw new IllegalStateException("Teaching password exceeds supported length for " + username);
            }
            Set<String> roles = username.equals("admin") ? Set.of("ADMIN", "CAMPUS_VIEWER")
                    : username.equals("viewer") ? Set.of("CAMPUS_VIEWER") : Set.of("CAMPUS_MANAGER");
            String display = switch (username) {
                case "admin" -> "教学管理员"; case "manager-a" -> "管理人员 A";
                case "manager-b" -> "管理人员 B"; default -> "教学查看者";
            };
            values.put(username, new Account(username, display, encoder.encode(password), true, roles));
        }
        accounts = Map.copyOf(values);
    }
    @Override public Optional<Account> find(String username) { return Optional.ofNullable(accounts.get(username)); }
}
