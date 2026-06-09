package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.PurchaseOrderCreateDTO;
import com.ams.entity.PurchaseOrder;
import com.ams.entity.PurchaseOrderItem;
import com.ams.mapper.PurchaseOrderItemMapper;
import com.ams.mapper.PurchaseOrderMapper;
import com.ams.mapper.VendorMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PurchaseOrderServiceTest {

    @Mock
    private PurchaseOrderMapper purchaseOrderMapper;

    @Mock
    private PurchaseOrderItemMapper purchaseOrderItemMapper;

    @Mock
    private VendorMapper vendorMapper;

    private PurchaseOrderService purchaseOrderService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
        purchaseOrderService = new PurchaseOrderService(purchaseOrderMapper, purchaseOrderItemMapper, vendorMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldSetTenantOnOrderAndItems() {
        when(purchaseOrderMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(purchaseOrderMapper.insert(any(PurchaseOrder.class))).thenAnswer(invocation -> {
            PurchaseOrder order = invocation.getArgument(0);
            order.setId(12L);
            return 1;
        });

        PurchaseOrderItem first = item("服务器", 2, "100.50");
        PurchaseOrderItem second = item("交换机", 1, "300.00");
        PurchaseOrderCreateDTO dto = new PurchaseOrderCreateDTO();
        dto.setOrderNo("PO-2026-001");
        dto.setOrderName("机房设备采购");
        dto.setVendorId(3L);
        dto.setOrderDate(LocalDate.of(2026, 6, 10));
        dto.setItems(List.of(first, second));

        PurchaseOrder result = purchaseOrderService.create(dto);

        assertEquals("dept:1", result.getTenantId());
        assertEquals(new BigDecimal("501.00"), result.getTotalAmount());

        ArgumentCaptor<PurchaseOrder> orderCaptor = ArgumentCaptor.forClass(PurchaseOrder.class);
        verify(purchaseOrderMapper).insert(orderCaptor.capture());
        assertEquals("dept:1", orderCaptor.getValue().getTenantId());

        ArgumentCaptor<PurchaseOrderItem> itemCaptor = ArgumentCaptor.forClass(PurchaseOrderItem.class);
        verify(purchaseOrderItemMapper, org.mockito.Mockito.times(2)).insert(itemCaptor.capture());
        List<PurchaseOrderItem> insertedItems = itemCaptor.getAllValues();
        assertEquals(List.of("dept:1", "dept:1"), insertedItems.stream().map(PurchaseOrderItem::getTenantId).toList());
        assertEquals(List.of(12L, 12L), insertedItems.stream().map(PurchaseOrderItem::getOrderId).toList());
    }

    private PurchaseOrderItem item(String name, int quantity, String unitPrice) {
        PurchaseOrderItem item = new PurchaseOrderItem();
        item.setAssetName(name);
        item.setQuantity(quantity);
        item.setUnitPrice(new BigDecimal(unitPrice));
        return item;
    }
}
