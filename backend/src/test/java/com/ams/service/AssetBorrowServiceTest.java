package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.AssetBorrow;
import com.ams.mapper.AssetBorrowMapper;
import com.ams.mapper.AssetMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssetBorrowServiceTest {

    @Mock
    private AssetBorrowMapper borrowMapper;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private TenantService tenantService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldScanOverdueBorrowsWithTenantContext() {
        AssetBorrowService service = new AssetBorrowService(borrowMapper, assetMapper, tenantService);
        AssetBorrow borrow = new AssetBorrow();
        borrow.setId(7L);
        borrow.setTenantId("dept:1");
        borrow.setStatus("BORROWED");
        borrow.setExpectedReturnDate(LocalDate.now().minusDays(1));

        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1"));
        when(borrowMapper.selectList(any(LambdaQueryWrapper.class))).thenAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            return List.of(borrow);
        });

        service.checkOverdue();

        assertEquals("OVERDUE", borrow.getStatus());
        assertEquals(1, borrow.getNotified());
        verify(borrowMapper).updateById(borrow);
        assertNull(TenantContext.getTenantId());
    }
}
