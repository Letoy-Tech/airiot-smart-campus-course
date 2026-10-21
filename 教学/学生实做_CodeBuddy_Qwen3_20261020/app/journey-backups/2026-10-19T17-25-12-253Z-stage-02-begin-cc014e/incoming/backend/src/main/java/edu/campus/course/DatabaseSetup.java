package edu.campus.course;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.*;

@Configuration
@Profile("teacher-db")
public class DatabaseSetup {
    @Bean
    ApplicationRunner seedTeachingRows(
            DbAccountDirectory directory, CampusMapper mapper, CatalogReader catalog) {
        return args -> {
            directory.seed();
            for (var device : catalog.allDevices().items()) mapper.seedOwner(device.id());
        };
    }
}
