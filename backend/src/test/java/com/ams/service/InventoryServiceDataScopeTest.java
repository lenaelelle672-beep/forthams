package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.InventoryTask;
import com.ams.mapper.InventoryDetailMapper;
import com.ams.mapper.InventoryTaskMapper;
import com.ams.security.DataScope;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventoryServiceDataScopeTest {

    @Mock
    private InventoryTaskMapper inventoryTaskMapper;
    @Mock
    private InventoryDetailMapper inventoryDetailMapper;
    @Mock
    private DataScopeService dataScopeService;

    private InventoryService inventoryService;

    @BeforeEach
    void setUp() {
        inventoryService = new InventoryService(inventoryTaskMapper, inventoryDetailMapper, dataScopeService);
        TenantContext.setTenantId("T001");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void getTaskByIdShouldRejectOutsideScope() {
        InventoryTask task = new InventoryTask();
        task.setId(4L);
        task.setTenantId("T001");
        task.setDeptIds("8,9");
        task.setExecutorId(2L);
        task.setCreateBy(3L);
        when(inventoryTaskMapper.selectOne(any())).thenReturn(task);
        when(dataScopeService.resolveCurrent()).thenReturn(DataScope.filtered(9L, Set.of(3L), false));

        assertThrows(AccessDeniedException.class, () -> inventoryService.getTaskById(4L));
    }
}
