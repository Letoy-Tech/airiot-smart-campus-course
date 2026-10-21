package cn.campus.course;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SeedData implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final String password;

    public SeedData(JdbcTemplate jdbc, ObjectMapper json, @Value("${campus.demo-password}") String password) {
        this.jdbc = jdbc;
        this.json = json;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM course_seed WHERE id='teaching-v2'", Integer.class) > 0) {
            return;
        }
        if (password.length() < 16 || password.length() > 64 || password.contains("CHANGE")) {
            throw new IllegalStateException("请先在工程根目录运行 node tools/setup-env.mjs，配置本机练习口令");
        }
        JsonNode root;
        try (var input = new ClassPathResource("data/mock-campus.json").getInputStream()) {
            root = json.readTree(input);
        }
        for (JsonNode s : root.withArray("spaces")) {
            jdbc.update("INSERT INTO spaces(id,name,building,floor) VALUES(?,?,?,?)",
                    s.path("id").asText(), s.path("name").asText(), s.path("building").asText(), s.path("floor").asText());
        }
        for (JsonNode d : root.withArray("devices")) {
            jdbc.update("INSERT INTO devices(id,name,category,space_id,online,simulated) VALUES(?,?,?,?,?,true)",
                    d.path("id").asText(), d.path("name").asText(), d.path("category").asText(), d.path("spaceId").asText(),
                    d.get("online").isNull() ? null : d.get("online").asBoolean());
        }
        for (String table : new String[]{"points", "history"}) {
            for (JsonNode item : root.withArray(table)) {
                jdbc.update("INSERT INTO " + table + "(device_id,tag_id,payload) VALUES(?,?,?)",
                        item.path("deviceId").asText(), item.path("tagId").asText(), item.toString());
            }
        }
        for (JsonNode alarm : root.withArray("alarms")) {
            jdbc.update("INSERT INTO alarms(id,device_id,payload) VALUES(?,?,?)",
                    alarm.path("id").asText(), alarm.path("deviceId").asText(), alarm.toString());
        }
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        for (String username : new String[]{"admin", "manager", "viewer"}) {
            jdbc.update("INSERT INTO users(username,password_hash,role) VALUES(?,?,?)",
                    username, encoder.encode(password), username.toUpperCase(java.util.Locale.ROOT));
        }
        jdbc.update("INSERT INTO course_seed(id) VALUES('teaching-v2')");
    }
}
