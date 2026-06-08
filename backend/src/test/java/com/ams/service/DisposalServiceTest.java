package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.AssetClearanceDTO;
import com.ams.dto.AssetScrapDTO;
import com.ams.dto.AssetTransferDTO;
import com.ams.entity.Asset;
import com.ams.enums.AssetStatus;
import com.ams.mapper.AssetChangeLogMapper;
import com.ams.mapper.AssetMapper;
import com.ams.service.DisposalService;
import com.ams.service.AssetLifecycleService;
import com.ams.service.WorkflowDefinitionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DisposalServiceTest {

    @Mock
    private AssetLifecycleService assetLifecycleService;

    @Mock
    private AssetChangeLogMapper assetChangeLogMapper;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private WorkflowDefinitionService workflowDefinitionService;

    private DisposalService disposalService;

    @BeforeEach
    void setUp() {
        disposalService = new DisposalService(assetLifecycleService, assetChangeLogMapper, assetMapper, workflowDefinitionService);
    }

    // ── transferAsset tests ──────────────────────────────────────────────

    @Test
    void transferAsset_shouldCallRequirePublishedDefinitionForASSET_TRANSFER() {
        AssetTransferDTO dto = new AssetTransferDTO();
        dto.setAssetId(100L);
        dto.setTargetDeptId(200L);
        dto.setTargetUserId(300L);
        dto.setTargetLocation("Building-A");
        dto.setReason("Department restructure");

        Asset transferredAsset = new Asset();
        transferredAsset.setId(100L);
        transferredAsset.setStatus(AssetStatus.IN_USE.name());

        when(workflowDefinitionService.requirePublishedDefinition("ASSET_TRANSFER"))
                .thenReturn(null);
        when(assetLifecycleService.transitionAsset(eq(100L), eq(AssetStatus.IN_USE), eq("TRANSFER"), eq("Department restructure"), isNull(), any()))
                .thenReturn(transferredAsset);

        Asset result = disposalService.transferAsset(dto);

        verify(workflowDefinitionService).requirePublishedDefinition("ASSET_TRANSFER");
        assertNotNull(result);
        assertEquals(100L, result.getId());
    }

    @Test
    void transferAsset_shouldThrowWhenWorkflowNotPublished() {
        AssetTransferDTO dto = new AssetTransferDTO();
        dto.setAssetId(100L);

        when(workflowDefinitionService.requirePublishedDefinition("ASSET_TRANSFER"))
                .thenThrow(new BusinessException("请先发布对应业务流程后再提交审批"));

        BusinessException exception = assertThrows(BusinessException.class, () -> disposalService.transferAsset(dto));
        assertEquals("请先发布对应业务流程后再提交审批", exception.getMessage());

        // Verify asset lifecycle was NOT called
        verifyNoInteractions(assetLifecycleService);
    }

    @Test
    void transferAsset_shouldInvokeTransitionAssetWithMutator() {
        AssetTransferDTO dto = new AssetTransferDTO();
        dto.setAssetId(1L);
        dto.setTargetDeptId(10L);
        dto.setTargetUserId(20L);
        dto.setTargetLocation("Floor-3");
        dto.setReason("Team move");

        when(workflowDefinitionService.requirePublishedDefinition("ASSET_TRANSFER")).thenReturn(null);
        when(assetLifecycleService.transitionAsset(eq(1L), eq(AssetStatus.IN_USE), eq("TRANSFER"), eq("Team move"), isNull(), any()))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    Consumer<Asset> mutator = invocation.getArgument(5, Consumer.class);
                    Asset asset = new Asset();
                    asset.setId(1L);
                    asset.setStatus(AssetStatus.IN_USE.name());
                    mutator.accept(asset);
                    return asset;
                });

        Asset result = disposalService.transferAsset(dto);

        verify(assetLifecycleService).transitionAsset(eq(1L), eq(AssetStatus.IN_USE), eq("TRANSFER"), eq("Team move"), isNull(), any());
        assertNotNull(result);
        assertEquals(10L, result.getDeptId());
        assertEquals(20L, result.getUserId());
        assertEquals("Floor-3", result.getLocation());
    }

    // ── clearAsset tests ─────────────────────────────────────────────────

    @Test
    void clearAsset_shouldCallRequirePublishedDefinitionForASSET_CLEARANCE() {
        AssetClearanceDTO dto = new AssetClearanceDTO();
        dto.setAssetId(200L);
        dto.setReason("Asset end-of-life");

        Asset clearedAsset = new Asset();
        clearedAsset.setId(200L);
        clearedAsset.setStatus(AssetStatus.CLEARED.name());

        when(workflowDefinitionService.requirePublishedDefinition("ASSET_CLEARANCE"))
                .thenReturn(null);
        when(assetLifecycleService.transitionStatus(200L, AssetStatus.CLEARED, "CLEARANCE", "Asset end-of-life", null))
                .thenReturn(clearedAsset);

        Asset result = disposalService.clearAsset(dto);

        verify(workflowDefinitionService).requirePublishedDefinition("ASSET_CLEARANCE");
        assertNotNull(result);
        assertEquals(AssetStatus.CLEARED.name(), result.getStatus());
    }

    @Test
    void clearAsset_shouldThrowWhenWorkflowNotPublished() {
        AssetClearanceDTO dto = new AssetClearanceDTO();
        dto.setAssetId(200L);

        when(workflowDefinitionService.requirePublishedDefinition("ASSET_CLEARANCE"))
                .thenThrow(new BusinessException("请先发布对应业务流程后再提交审批"));

        BusinessException exception = assertThrows(BusinessException.class, () -> disposalService.clearAsset(dto));
        assertEquals("请先发布对应业务流程后再提交审批", exception.getMessage());

        verifyNoInteractions(assetLifecycleService);
    }

    // ── scrapAsset tests ─────────────────────────────────────────────────

    @Test
    void scrapAsset_shouldCallRequirePublishedDefinitionForASSET_SCRAP() {
        AssetScrapDTO dto = new AssetScrapDTO();
        dto.setAssetId(300L);
        dto.setReason("Hardware failure beyond repair");

        Asset scrappedAsset = new Asset();
        scrappedAsset.setId(300L);
        scrappedAsset.setStatus(AssetStatus.SCRAPPED.name());

        when(workflowDefinitionService.requirePublishedDefinition("ASSET_SCRAP"))
                .thenReturn(null);
        when(assetLifecycleService.transitionStatus(300L, AssetStatus.SCRAPPED, "SCRAP", "Hardware failure beyond repair", null))
                .thenReturn(scrappedAsset);

        Asset result = disposalService.scrapAsset(dto);

        verify(workflowDefinitionService).requirePublishedDefinition("ASSET_SCRAP");
        assertNotNull(result);
        assertEquals(AssetStatus.SCRAPPED.name(), result.getStatus());
    }

    @Test
    void scrapAsset_shouldThrowWhenWorkflowNotPublished() {
        AssetScrapDTO dto = new AssetScrapDTO();
        dto.setAssetId(300L);

        when(workflowDefinitionService.requirePublishedDefinition("ASSET_SCRAP"))
                .thenThrow(new BusinessException("请先发布对应业务流程后再提交审批"));

        BusinessException exception = assertThrows(BusinessException.class, () -> disposalService.scrapAsset(dto));
        assertEquals("请先发布对应业务流程后再提交审批", exception.getMessage());

        verifyNoInteractions(assetLifecycleService);
    }
}
