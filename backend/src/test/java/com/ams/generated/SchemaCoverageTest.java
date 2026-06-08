package com.ams.generated;

import com.ams.entity.RetirementApplication;
import com.ams.entity.WorkOrder;
import com.baomidou.mybatisplus.annotation.TableName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SchemaCoverageTest {

    @Test
    void entitiesShouldMapToExpectedTablesWithoutRequiringDdlChanges() {
        assertTableName(WorkOrder.class, "work_order");
        assertTableName(RetirementApplication.class, "retirement_application");
    }

    private void assertTableName(Class<?> entityClass, String table) {
        TableName tableName = entityClass.getAnnotation(TableName.class);

        assertThat(tableName).isNotNull();
        assertThat(tableName.value()).isEqualTo(table);
    }
}
