package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AssetCreateDTO;
import com.ams.dto.IntakeOrderCreateDTO;
import com.ams.dto.IntakeAssetDTO;
import com.ams.dto.IntakeCheckItemDTO;
import com.ams.entity.Asset;
import com.ams.entity.IntakeAsset;
import com.ams.entity.IntakeCheckItem;
import com.ams.entity.IntakeOrder;
import com.ams.enums.AssetStatus;
import com.ams.mapper.IntakeAssetMapper;
import com.ams.mapper.IntakeCheckItemMapper;
import com.ams.mapper.IntakeOrderMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IntakeOrderServiceTest {

    @Mock
    private IntakeOrderMapper intakeOrderMapper;

    @Mock
    private IntakeCheckItemMapper intakeCheckItemMapper;

    @Mock
    private IntakeAssetMapper intakeAssetMapper;

    @Mock
    private AssetService assetService;

    @InjectMocks
    private IntakeOrderService intakeOrderService;

    @Captor
    private ArgumentCaptor<LambdaQueryWrapper<IntakeCheckItem>> checkItemWrapperCaptor;

    @Captor
    private ArgumentCaptor<LambdaQueryWrapper<IntakeAsset>> intakeAssetWrapperCaptor;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldSubmitDraftOrder() {
        // 准备：一个 DRAFT 状态的验收单
        IntakeOrder order = draftOrder();
        when(intakeOrderMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(order);
        when(intakeCheckItemMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of());
        when(intakeAssetMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of());

        // 执行：提交
        IntakeOrder result = intakeOrderService.submit(1L);

        // 验证：状态变为 PENDING_INSPECT
        assertEquals("PENDING_INSPECT", result.getStatus());
        verify(intakeOrderMapper).updateById(order);
    }

    @Test
    void shouldRejectSubmitForNonDraftOrder() {
        IntakeOrder order = draftOrder();
        order.setStatus("PENDING_INSPECT");
        when(intakeOrderMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(order);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> intakeOrderService.submit(1L));
        assertEquals("只有草稿状态的验收单可以提交", exception.getMessage());
    }

    @Test
    void shouldRejectDeleteForNonDraftOrder() {
        IntakeOrder order = draftOrder();
        order.setStatus("ACCEPTED");
        when(intakeOrderMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(order);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> intakeOrderService.delete(1L));
        assertEquals("只有草稿状态的验收单可以删除", exception.getMessage());
    }

    @Test
    void shouldDeleteWithTenantIdInCascade() {
        // 准备：一个 DRAFT 状态验收单
        IntakeOrder order = draftOrder();
        when(intakeOrderMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(order);
        when(intakeCheckItemMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of());
        when(intakeAssetMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of());

        // 执行：删除
        intakeOrderService.delete(1L);

        // 验证级联删除时附加了 tenantId 过滤
        verify(intakeCheckItemMapper).delete(checkItemWrapperCaptor.capture());
        LambdaQueryWrapper<IntakeCheckItem> checkWrapper = checkItemWrapperCaptor.getValue();
        assertNotNull(checkWrapper);

        verify(intakeAssetMapper).delete(intakeAssetWrapperCaptor.capture());
        LambdaQueryWrapper<IntakeAsset> assetWrapper = intakeAssetWrapperCaptor.getValue();
        assertNotNull(assetWrapper);

        verify(intakeOrderMapper).deleteById(1L);
    }

    @Test
    void shouldSetLocationIdWhenCreatingAssetInAccept() {
        // 准备：一个 INSPECTING 状态的验收单，包含一条带 locationId 的资产
        IntakeOrder order = draftOrder();
        order.setStatus("INSPECTING");

        IntakeCheckItem passItem = new IntakeCheckItem();
        passItem.setResult("PASS");

        IntakeAsset intakeAsset = new IntakeAsset();
        intakeAsset.setId(10L);
        intakeAsset.setAssetNo("AST-001");
        intakeAsset.setAssetName("测试资产");
        intakeAsset.setCategoryId(1L);
        intakeAsset.setLocationId(99L); // 关键：locationId
        intakeAsset.setOriginalValue(new BigDecimal("1000.00"));

        when(intakeOrderMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(order);
        when(intakeCheckItemMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(passItem));
        when(intakeAssetMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(intakeAsset));

        Asset createdAsset = new Asset();
        createdAsset.setId(100L);
        createdAsset.setAssetName("测试资产");
        when(assetService.createAsset(any(AssetCreateDTO.class)))
                .thenReturn(createdAsset);

        // 执行：验收通过
        intakeOrderService.accept(1L);

        // 验证：createAsset 的 DTO 中 locationId 被正确设置
        ArgumentCaptor<AssetCreateDTO> dtoCaptor = ArgumentCaptor.forClass(AssetCreateDTO.class);
        verify(assetService).createAsset(dtoCaptor.capture());
        AssetCreateDTO captured = dtoCaptor.getValue();
        assertEquals(99L, captured.getLocationId(), "locationId 应被映射到 AssetCreateDTO");
        assertEquals("AST-001", captured.getAssetNo());
        assertEquals("测试资产", captured.getAssetName());
    }

    @Test
    void shouldRejectAcceptWithFailedCheckItem() {
        IntakeOrder order = draftOrder();
        order.setStatus("INSPECTING");

        IntakeCheckItem failItem = new IntakeCheckItem();
        failItem.setResult("FAIL");

        when(intakeOrderMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(order);
        when(intakeCheckItemMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(failItem));
        when(intakeAssetMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> intakeOrderService.accept(1L));
        assertEquals("存在检查未通过项，无法验收通过", exception.getMessage());
    }

    @Test
    void shouldPartialAcceptSelectedAssets() {
        // 准备：一个 INSPECTING 状态的验收单，包含 2 条资产
        IntakeOrder order = draftOrder();
        order.setStatus("INSPECTING");

        IntakeCheckItem passItem = new IntakeCheckItem();
        passItem.setResult("PASS");

        IntakeAsset asset1 = new IntakeAsset();
        asset1.setId(1L);
        asset1.setAssetNo("AST-001");
        asset1.setAssetName("资产1");
        asset1.setCategoryId(1L);
        asset1.setLocationId(10L);

        IntakeAsset asset2 = new IntakeAsset();
        asset2.setId(2L);
        asset2.setAssetNo("AST-002");
        asset2.setAssetName("资产2");
        asset2.setCategoryId(1L);
        asset2.setLocationId(20L);

        when(intakeOrderMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(order);
        when(intakeCheckItemMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(passItem));
        when(intakeAssetMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(asset1, asset2));

        Asset createdAsset = new Asset();
        createdAsset.setId(100L);
        when(assetService.createAsset(any(AssetCreateDTO.class)))
                .thenReturn(createdAsset);

        // 执行：只验收 asset1
        intakeOrderService.partialAccept(1L, List.of(1L));

        // 验证：仅 asset1 被创建为正式资产
        verify(assetService, times(1)).createAsset(any(AssetCreateDTO.class));
        // 验证状态变为 PARTIAL_ACCEPTED
        ArgumentCaptor<IntakeOrder> orderCaptor = ArgumentCaptor.forClass(IntakeOrder.class);
        verify(intakeOrderMapper).updateById(orderCaptor.capture());
        assertEquals("PARTIAL_ACCEPTED", orderCaptor.getValue().getStatus());
    }

    private IntakeOrder draftOrder() {
        IntakeOrder order = new IntakeOrder();
        order.setId(1L);
        order.setOrderNo("IO-2026-0001");
        order.setStatus("DRAFT");
        order.setTenantId("dept:1");
        return order;
    }
}
