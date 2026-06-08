package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.CompensationCreateDTO;
import com.ams.dto.CompensationValuationDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetCompensation;
import com.ams.entity.WorkflowDefinition;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.AssetCompensationMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CompensationServiceTest {

    @Mock
    private AssetCompensationMapper assetCompensationMapper;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private WorkflowDefinitionService workflowDefinitionService;

    @InjectMocks
    private CompensationService compensationService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldRejectMissingResponsibleUser() {
        CompensationCreateDTO dto = new CompensationCreateDTO();
        dto.setAssetId(12L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> compensationService.createCompensation(dto));

        assertEquals("赔偿责任人不能为空", exception.getMessage());
        verifyNoInteractions(assetCompensationMapper);
    }

    @Test
    void shouldRejectMissingAsset() {
        CompensationCreateDTO dto = new CompensationCreateDTO();
        dto.setResponsibleUserId(42L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> compensationService.createCompensation(dto));

        assertEquals("资产不能为空", exception.getMessage());
        verifyNoInteractions(assetCompensationMapper);
    }

    @Test
    void shouldCreateCompensationWithExplicitBusinessIds() {
        CompensationCreateDTO dto = new CompensationCreateDTO();
        dto.setAssetId(12L);
        dto.setResponsibleUserId(42L);
        dto.setCompensationAmount(new BigDecimal("100.00"));
        when(workflowDefinitionService.requirePublishedDefinition("ASSET_COMPENSATION")).thenReturn(new WorkflowDefinition());
        when(assetCompensationMapper.selectCount(any(QueryWrapper.class))).thenReturn(0L);

        compensationService.createCompensation(dto);

        ArgumentCaptor<AssetCompensation> captor = ArgumentCaptor.forClass(AssetCompensation.class);
        verify(assetCompensationMapper).insert(captor.capture());
        AssetCompensation compensation = captor.getValue();
        assertEquals("T001", compensation.getTenantId());
        assertEquals(12L, compensation.getAssetId());
        assertEquals(42L, compensation.getResponsibleUserId());
        assertTrue(compensation.getCompensationNo().matches("CMP-\\d{8}-001"));
    }

    @Test
    void shouldRejectCompensationWhenWorkflowIsNotPublished() {
        CompensationCreateDTO dto = new CompensationCreateDTO();
        dto.setAssetId(12L);
        dto.setResponsibleUserId(42L);
        when(workflowDefinitionService.requirePublishedDefinition("ASSET_COMPENSATION"))
                .thenThrow(new BusinessException("请先发布对应业务流程后再提交审批"));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> compensationService.createCompensation(dto));

        assertEquals("请先发布对应业务流程后再提交审批", exception.getMessage());
        verifyNoInteractions(assetCompensationMapper);
    }

    @Test
    void shouldEstimateCompensationFromAssetCurrentValue() {
        CompensationCreateDTO dto = new CompensationCreateDTO();
        dto.setAssetId(12L);
        dto.setCompensationType("设备丢失");
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setCurrentValue(new BigDecimal("800.00"));
        asset.setOriginalValue(new BigDecimal("1000.00"));
        when(assetMapper.selectOne(any(QueryWrapper.class))).thenReturn(asset);

        CompensationValuationDTO valuation = compensationService.estimateCompensation(dto);

        assertEquals(new BigDecimal("800.00"), valuation.getEstimatedAmount());
        assertEquals(new BigDecimal("800.00"), valuation.getBaseAmount());
        assertTrue(valuation.getValuationBasis().contains("资产当前价值"));
    }

    @Test
    void shouldAutoFillCompensationAmountWhenMissing() {
        CompensationCreateDTO dto = new CompensationCreateDTO();
        dto.setAssetId(12L);
        dto.setResponsibleUserId(42L);
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setOriginalValue(new BigDecimal("1000.00"));
        when(workflowDefinitionService.requirePublishedDefinition("ASSET_COMPENSATION")).thenReturn(new WorkflowDefinition());
        when(assetMapper.selectOne(any(QueryWrapper.class))).thenReturn(asset);
        when(assetCompensationMapper.selectCount(any(QueryWrapper.class))).thenReturn(0L);

        compensationService.createCompensation(dto);

        ArgumentCaptor<AssetCompensation> captor = ArgumentCaptor.forClass(AssetCompensation.class);
        verify(assetCompensationMapper).insert(captor.capture());
        assertEquals(new BigDecimal("1000.00"), captor.getValue().getCompensationAmount());
    }
}
