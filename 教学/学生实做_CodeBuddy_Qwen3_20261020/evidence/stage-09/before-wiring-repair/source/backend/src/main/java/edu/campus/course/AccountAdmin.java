package edu.campus.course;

import java.sql.DriverManager;
import java.util.Arrays;
import java.util.Set;

/** Teacher-operated process only. There is no account mutation HTTP endpoint. */
public final class AccountAdmin {
    private AccountAdmin() {}

    public static void run(String[] args) {
        try {
            if (args.length != 3
                    || !Set.of("admin", "manager-a", "manager-b", "viewer").contains(args[0]))
                throw new IllegalArgumentException();
            String column, value;
            if (args[1].equals("--roles")) {
                if (args[2].isBlank()
                        || Arrays.stream(args[2].split(",", -1))
                                .anyMatch(
                                        r ->
                                                !Set.of("ADMIN", "CAMPUS_MANAGER", "CAMPUS_VIEWER")
                                                        .contains(r)))
                    throw new IllegalArgumentException();
                column = "roles";
                value =
                        String.join(
                                ",", new java.util.TreeSet<>(Arrays.asList(args[2].split(","))));
            } else if (args[1].equals("--enabled") && Set.of("true", "false").contains(args[2])) {
                column = "enabled";
                value = args[2].equals("true") ? "1" : "0";
            } else throw new IllegalArgumentException();
            String url = System.getenv("COURSE_DB_URL");
            if (!"true".equals(System.getenv("COURSE_ALLOW_ACCOUNT_ADMINISTRATION"))
                    || url == null
                    || !url.startsWith("jdbc:mysql://")) throw new IllegalArgumentException();
            try (var connection =
                    DriverManager.getConnection(
                            url,
                            System.getenv("COURSE_DB_USERNAME"),
                            System.getenv("COURSE_DB_PASSWORD"))) {
                if (connection.getCatalog() == null
                        || !connection.getCatalog().matches("campus_course_[A-Za-z0-9_]+"))
                    throw new IllegalArgumentException();
                String sql =
                        column.equals("roles")
                                ? "UPDATE course_identity SET roles=? WHERE uid=?"
                                : "UPDATE course_identity SET enabled=? WHERE uid=?";
                try (var statement = connection.prepareStatement(sql)) {
                    statement.setString(1, value);
                    statement.setString(2, args[0]);
                    if (statement.executeUpdate() != 1) throw new IllegalStateException();
                }
            }
            System.out.println("Teaching identity updated: " + args[0]);
        } catch (Exception e) {
            System.err.println(
                    "Account command failed. Use: account <teaching-uid> --roles"
                        + " <comma-separated-roles> OR --enabled true|false. Explicit authorization"
                        + " and dedicated teaching schema required.");
            System.exit(2);
        }
    }
}
