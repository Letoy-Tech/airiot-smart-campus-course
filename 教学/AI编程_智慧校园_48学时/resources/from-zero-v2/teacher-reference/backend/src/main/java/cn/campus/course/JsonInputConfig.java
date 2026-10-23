package cn.campus.course;

import com.fasterxml.jackson.databind.cfg.CoercionAction;
import com.fasterxml.jackson.databind.cfg.CoercionInputShape;
import com.fasterxml.jackson.databind.type.LogicalType;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JsonInputConfig {
    @Bean
    Jackson2ObjectMapperBuilderCustomizer strictIntegerInput() {
        return builder -> builder.postConfigurer(mapper -> {
            var integers = mapper.coercionConfigFor(LogicalType.Integer);
            for (var shape : new CoercionInputShape[]{CoercionInputShape.Float,
                    CoercionInputShape.String, CoercionInputShape.EmptyString,
                    CoercionInputShape.Boolean}) {
                integers.setCoercion(shape, CoercionAction.Fail);
            }
        });
    }
}
