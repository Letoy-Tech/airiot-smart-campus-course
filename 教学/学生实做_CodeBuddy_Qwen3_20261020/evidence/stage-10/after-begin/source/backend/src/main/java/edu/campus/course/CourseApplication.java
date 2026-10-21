package edu.campus.course;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CourseApplication {
    public static void main(String[] args) {
        if (args.length > 0 && args[0].equals("account")) {
            AccountAdmin.run(java.util.Arrays.copyOfRange(args, 1, args.length));
            return;
        }
        var context = SpringApplication.run(CourseApplication.class, args);
        if (context.getEnvironment().getProperty("course.migrate-only", Boolean.class, false))
            context.close();
    }
}
