package edu.campus.course;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class Access {
    private Access() {}

    public static String uid() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }

    public static boolean role(String role) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null
                && auth.getAuthorities().stream()
                        .anyMatch(a -> a.getAuthority().equals("ROLE_" + role));
    }

    public static void admin() {
        if (!role("ADMIN")) throw new ApiFailure(403, "ACCESS_DENIED");
    }

    public static void handler(String assignee) {
        if (!role("ADMIN") && !(role("CAMPUS_MANAGER") && uid().equals(assignee)))
            throw new ApiFailure(403, "ACCESS_DENIED");
    }
}
