package com.ams.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ReservedIdentifierEntityMappingTest {

    @Test
    void sensitiveColumnsAreQuotedForMySqlGeneratedSql() throws NoSuchFieldException {
        assertThat(FormFieldValue.class.getDeclaredField("sensitive").getAnnotation(TableField.class).value())
                .isEqualTo("`sensitive`");
        assertThat(TodoFieldConfig.class.getDeclaredField("sensitive").getAnnotation(TableField.class).value())
                .isEqualTo("`sensitive`");
    }
}
