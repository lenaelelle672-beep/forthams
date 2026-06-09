package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.AssetBorrow;
import com.ams.entity.NotificationRecord;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentCaptor.forClass;
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

    @Mock
    private NotificationService notificationService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldScanOverdueBorrowsWithTenantContext() {
        AssetBorrowService service = new AssetBorrowService(borrowMapper, assetMapper, tenantService, notificationService);
        AssetBorrow borrow = new AssetBorrow();
        borrow.setId(7L);
        borrow.setAssetId(12L);
        borrow.setBorrowerId(42L);
        borrow.setTenantId("dept:1");
        borrow.setStatus("BORROWED");
        borrow.setExpectedReturnDate(LocalDate.now().minusDays(1));
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setAssetNo("A-001");
        asset.setAssetName("测试资产");

        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1"));
        when(borrowMapper.selectList(any(LambdaQueryWrapper.class))).thenAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            return List.of(borrow);
        });
        when(assetMapper.selectById(eq(12L))).thenReturn(asset);

        service.checkOverdue();

        assertEquals("OVERDUE", borrow.getStatus());
        assertEquals(1, borrow.getNotified());
        verify(borrowMapper).updateById(borrow);
        var notificationCaptor = forClass(NotificationRecord.class);
        verify(notificationService).create(notificationCaptor.capture());
        NotificationRecord notification = notificationCaptor.getValue();
        assertEquals(42L, notification.getUserId());
        assertEquals("资产借用已逾期", notification.getTitle());
        assertEquals("ASSET_BORROW", notification.getType());
        assertEquals("OPERATION", notification.getCategory());
        assertEquals(7L, notification.getRefId());
        assertEquals("ASSET_BORROW", notification.getRefType());
        assertNull(TenantContext.getTenantId());
    }
}
