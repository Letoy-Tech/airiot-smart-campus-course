package com.letoy.main.common.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RandomUtilTests {

    @Test
    void shouldGenerateUppercaseUuidWithoutHyphen() {
        String value = RandomUtil.getRandomId();

        assertNotNull(value);
        assertEquals(32, value.length());
        assertTrue(value.matches("[A-F0-9]{32}"));
    }

    @Test
    void shouldGenerateSixDigitVerificationCode() {
        String value = RandomUtil.getCode();

        assertNotNull(value);
        assertTrue(value.matches("\\d{6}"));
    }
}
