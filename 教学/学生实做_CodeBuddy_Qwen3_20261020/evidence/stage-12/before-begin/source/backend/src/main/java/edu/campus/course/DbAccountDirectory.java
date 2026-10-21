package edu.campus.course;

import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
@Profile("teacher-db")
public class DbAccountDirectory extends LocalAccountDirectory {
    private final CampusMapper mapper;

    public DbAccountDirectory(
            Environment environment, PasswordEncoder encoder, CampusMapper mapper) {
        super(environment, encoder);
        this.mapper = mapper;
    }

    public void seed() {
        for (String uid : List.of("admin", "manager-a", "manager-b", "viewer")) {
            Account a = super.find(uid).orElseThrow();
            mapper.seedIdentity(
                    new CourseModels.UserState(
                            uid, true, String.join(",", new TreeSet<>(a.roles()))));
        }
    }

    @Override
    public Optional<Account> find(String username) {
        Optional<Account> original = super.find(username);
        if (original.isEmpty()) return Optional.empty();
        var state = mapper.identity(username);
        if (state == null) return Optional.empty();
        Set<String> roles = new HashSet<>();
        for (String role : state.roles().split(",")) {
            if (!Set.of("ADMIN", "CAMPUS_MANAGER", "CAMPUS_VIEWER").contains(role))
                return Optional.empty();
            roles.add(role);
        }
        var a = original.get();
        return Optional.of(
                new Account(
                        a.username(), a.displayName(), a.passwordHash(), state.enabled(), roles));
    }
}
