package edu.campus.course;

import java.util.Optional;
import java.util.Set;

public interface AccountDirectory {
    Optional<Account> find(String username);

    // Password hashes never appear in API DTOs or toString().
    final class Account {
        private final String username;
        private final String displayName;
        private final String passwordHash;
        private final boolean enabled;
        private final Set<String> roles;

        public Account(
                String username,
                String displayName,
                String passwordHash,
                boolean enabled,
                Set<String> roles) {
            this.username = username;
            this.displayName = displayName;
            this.passwordHash = passwordHash;
            this.enabled = enabled;
            this.roles = Set.copyOf(roles);
        }

        public String username() {
            return username;
        }

        public String displayName() {
            return displayName;
        }

        public String passwordHash() {
            return passwordHash;
        }

        public boolean enabled() {
            return enabled;
        }

        public Set<String> roles() {
            return roles;
        }

        @Override
        public String toString() {
            return "Account[username=" + username + "]";
        }
    }
}
