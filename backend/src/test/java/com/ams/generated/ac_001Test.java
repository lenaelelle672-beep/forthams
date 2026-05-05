package com.ams.generated;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AcGeneratedTest {

    @Test
    void ac001_workOrderClassShouldExist() throws Exception {
        Class<?> clazz = Class.forName("com.ams.entity.WorkOrder");
        assertNotNull(clazz);
    }

    @Test
    void ac002_workOrderShouldExposeAuditFields() throws Exception {
        Class<?> clazz = Class.forName("com.ams.entity.WorkOrder");
        assertNotNull(clazz.getDeclaredField("createTime"));
        assertNotNull(clazz.getDeclaredField("updateTime"));
        assertNotNull(clazz.getDeclaredField("deleted"));
    }

    @Test
    void ac003_workOrderControllerShouldExist() throws Exception {
        Class<?> clazz = Class.forName("com.ams.controller.WorkOrderController");
        assertNotNull(clazz);
    }

    @Test
    void ac004_retirementControllerShouldExist() throws Exception {
        Class<?> clazz = Class.forName("com.ams.controller.RetirementController");
        assertNotNull(clazz);
    }

    @Test
    void ac005_retirementEntityShouldExist() throws Exception {
        Class<?> clazz = Class.forName("com.ams.entity.RetirementApplication");
        assertNotNull(clazz);
    }
}
