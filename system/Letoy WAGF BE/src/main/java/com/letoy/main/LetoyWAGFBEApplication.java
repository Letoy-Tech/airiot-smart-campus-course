package com.letoy.main;

import com.letoy.main.aliyun.config.AliyunProperties;
import com.letoy.main.behavior.config.UserBehaviorLogProperties;
import com.letoy.main.auth.security.JwtProperties;
import com.letoy.main.auth.security.WhitelistProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestTemplate;

@SpringBootApplication
@EnableConfigurationProperties({JwtProperties.class, WhitelistProperties.class, AliyunProperties.class, UserBehaviorLogProperties.class})
public class LetoyWAGFBEApplication {

    public static void main(String[] args) {
        SpringApplication.run(LetoyWAGFBEApplication.class, args);
    }

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
