package com.ams.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.databind.ser.std.StdScalarSerializer;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.math.BigDecimal;

/**
 * Jackson 全局序列化策略（S0.5c R1 根治）。
 *
 * <p>问题：Java 后端默认把 BigDecimal 序列化为 number 形式（如 {@code 0.1} 浮点丢精度），
 * 极值场景（{@code amount > Number.MAX_SAFE_INTEGER}）会直接丢精度。
 * 前端 TypeScript 类型用 {@code number} 接收，无法表达极大值与小数点精度。</p>
 *
 * <p>本方案：把 BigDecimal 全局序列化为 String，保留全部小数位数字与量级，
 * 前端用 string 接收 + Number() 转换做展示运算。同步自定义一个 BigDecimal 序列化器，
 * 自动处理 {@code null} 与零值场景。</p>
 *
 * <p>注：报表导出、Excel 流式端点如需保留 number 行为，可通过局部
 * {@code @JsonSerialize(using=...)} 标注覆盖。</p>
 */
@Configuration
public class JacksonConfig {

    /**
     * 自定义 ObjectMapper Builder：开启 BigDecimal→String 全局序列化。
     */
    @Bean
    public Jackson2ObjectMapperBuilderCustomizer bigDecimalAsStringCustomizer() {
        return builder -> {
            SimpleModule bigDecimalModule = new SimpleModule("AmsBigDecimalAsString");
            bigDecimalModule.addSerializer(BigDecimal.class, new BigDecimalAsStringSerializer());
            builder.modulesToInstall(bigDecimalModule);
        };
    }

    /**
     * BigDecimal 序列化为 String：
     * - null 写 null
     * - 0 写 "0"
     * - 其他走 BigDecimal.toPlainString()（避免科学计数法）
     */
    static class BigDecimalAsStringSerializer extends StdScalarSerializer<BigDecimal> {

        private static final long serialVersionUID = 1L;

        BigDecimalAsStringSerializer() {
            super(BigDecimal.class);
        }

        @Override
        public void serialize(BigDecimal value, JsonGenerator gen, SerializerProvider provider) throws IOException {
            if (value == null) {
                gen.writeNull();
                return;
            }
            gen.writeString(value.toPlainString());
        }
    }
}
