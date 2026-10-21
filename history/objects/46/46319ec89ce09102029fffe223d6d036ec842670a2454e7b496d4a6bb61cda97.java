package edu.campus.course;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

class LocalAccountDirectoryTest {
    @Test void eachMissingPasswordFailsRatherThanCreatingDefaultCredential() {
        for (String missing : new String[]{"admin", "manager-a", "manager-b", "viewer"}) {
            MockEnvironment env = new MockEnvironment();
            for (String user : new String[]{"admin", "manager-a", "manager-b", "viewer"}) {
                if (!user.equals(missing)) env.setProperty("course.passwords." + user, UUID.randomUUID().toString());
            }
            assertThatThrownBy(() -> new LocalAccountDirectory(env, new BCryptPasswordEncoder()))
                    .isInstanceOf(IllegalStateException.class).hasMessageContaining(missing);
        }
    }
}
