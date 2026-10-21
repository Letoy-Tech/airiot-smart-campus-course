package edu.campus.v2.web;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import java.io.IOException;
import java.math.BigInteger;

/**
 * 只接受 JSON 里的非负整数字面量：不带引号、不带小数点、不是布尔、不是 null。
 * 不做任何隐式转换：0.5、1.0、"0"、true、负数、超出 int 范围一律在反序列化阶段报错，
 * 由 HttpMessageNotReadableException 变成 400，服务层与数据库都不会收到这个值。
 * 这是字段级限制，不依赖也不修改全局 Jackson 宽松设置。
 */
public class StrictNonNegativeIntDeserializer extends JsonDeserializer<Integer> {

    private static final BigInteger MAX = BigInteger.valueOf(Integer.MAX_VALUE);

    @Override
    public Integer deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (parser.currentToken() != JsonToken.VALUE_NUMBER_INT) {
            // 字符串、布尔、小数、null 等都不是“JSON 非负整数字面量”。
            throw MismatchedInputException.from(parser, Integer.class,
                    "expectedVersion 必须是 JSON 非负整数");
        }

        BigInteger value = parser.getBigIntegerValue();
        if (value.signum() < 0 || value.compareTo(MAX) > 0) {
            throw MismatchedInputException.from(parser, Integer.class,
                    "expectedVersion 必须是 0 到 " + Integer.MAX_VALUE + " 之间的整数");
        }

        return value.intValue();
    }
}
