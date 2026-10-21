package cn.campus.course;

import static org.junit.jupiter.api.Assertions.*;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

class InputValidationTest {
    @Test
    void ownerNoteRejectsNullEmptyAndWhitespaceBeforeCallingDatabase() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (String note : new String[]{null, "", " \t\n "}) {
                var errors = validator.validate(new CampusController.OwnerEdit("manager", note, 0L));
                assertTrue(errors.stream().anyMatch(error -> error.getPropertyPath().toString().equals("note")));
            }
            assertTrue(validator.validate(new CampusController.OwnerEdit("manager", "本课巡查负责人", 0L)).isEmpty());
        }
    }
}
