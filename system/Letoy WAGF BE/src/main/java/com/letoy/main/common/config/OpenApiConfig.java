package com.letoy.main.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
public class OpenApiConfig {

    @Value("${swagger_scan_packages:com.letoy.main}")
    private String swaggerScanPackages;

    @Bean
    public GroupedOpenApi defaultGroupedOpenApi() {
        List<String> packages = resolvePackages();
        return GroupedOpenApi.builder()
                .group("default")
                .packagesToScan(packages.toArray(new String[0]))
                .build();
    }

    @Bean
    public OpenAPI customOpenApi() {
        SecurityScheme apiKeyScheme = new SecurityScheme()
                .type(SecurityScheme.Type.APIKEY)
                .in(SecurityScheme.In.HEADER)
                .name("Authorization");

        return new OpenAPI()
                .info(apiInfo())
                .components(new Components().addSecuritySchemes("x-auth-token", apiKeyScheme))
                .addSecurityItem(new SecurityRequirement().addList("x-auth-token"));
    }

    private Info apiInfo() {
        return new Info()
                .title("Backend Template")
                .description("Reusable Spring Boot backend template with user and permission modules")
                .version("1.0.0")
                .contact(new Contact().name("Template Maintainer"))
                .license(new License().name("Apache 2.0"));
    }

    private List<String> resolvePackages() {
        return Arrays.stream(swaggerScanPackages.split(";"))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toList());
    }
}
