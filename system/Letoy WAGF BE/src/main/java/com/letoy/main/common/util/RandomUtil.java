package com.letoy.main.common.util;

import java.util.Random;
import java.util.UUID;

public class RandomUtil {
    public static String getRandomId() {
        return UUID.randomUUID().toString().replace("-", "").toUpperCase();
    }

    public static String getCode() {
        int max = 999999, min = 100000;
        Random random = new Random();
        int code = random.nextInt(max) % (max - min + 1) + min;
        return String.valueOf(code);
    }

    public static void main(String[] args) {
        System.out.println(getRandomId());

    }

}
