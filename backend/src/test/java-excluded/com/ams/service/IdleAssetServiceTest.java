package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.IdleAssetCreateDTO;
import com.ams.entity.Asset;
import com.ams.entity.IdleAssetNotice;
import com.ams.enums.AssetStatus;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.IdleAssetNoticeMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IdleAssetServiceTest {

    @Mock
    private IdleAssetNoticeMapper idleAssetNoticeMapper;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private AssetLifecycleService assetLifecycleService;

    @InjectMocks
    private IdleAssetService idleAssetService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void publishNoticeShouldRequireIdleAssetAndPersistAnnouncement() {
        IdleAssetCreateDTO dto = new IdleAssetCreateDTO();
        dto.setAssetId(10L);
        dto.setIdleDays(45);
        dto.setTitle("会议室投影仪闲置公告");
        dto.setReason("连续 45 天未使用");

        Asset asset = asset(10L, "会议室投影仪", AssetStatus.IDLE.name());
        when(assetMapper.selectOne(any(QueryWrapper.class))).thenReturn(asset);
        when(idleAssetNoticeMapper.selectCount(any(QueryWrapper.class))).thenReturn(0L);

        IdleAssetNotice result = idleAssetService.publishNotice(dto, 1L);

        assertEquals("PUBLISHED", result.getStatus());
        assertEquals(10L, result.getAssetId());
        assertEquals("会议室投影仪闲置公告", result.getTitle());
        assertEquals("连续 45 天未使用", result.getReason());
        verify(idleAssetNoticeMapper).insert(result);
    }

    @Test
    void publishNoticeShouldRejectNonIdleAsset() {
        IdleAssetCreateDTO dto = new IdleAssetCreateDTO();
        dto.setAssetId(10L);
        dto.setReason("仍在使用");
        when(assetMapper.selectOne(any(QueryWrapper.class))).thenReturn(asset(10L, "笔记本", AssetStatus.IN_USE.name()));

        assertThrows(BusinessException.class, () -> idleAssetService.publishNotice(dto, 1L));
    }


    @Test
    void publishNoticeShouldDenyWhenAssetMissingOrOutsideCurrentTenant() {
        IdleAssetCreateDTO dto = new IdleAssetCreateDTO();
        dto.setAssetId(10L);
        dto.setIdleDays(45);
        dto.setTitle("会议室投影仪闲置公告");
        dto.setReason("当前租户不可见");
        when(assetMapper.selectOne(any(QueryWrapper.class))).thenReturn(null);

        BusinessException ex = assertThrows(BusinessException.class, () -> idleAssetService.publishNotice(dto, 1L));

        assertEquals(400, ex.getCode());
        assertEquals("资产不存在或不属于当前租户", ex.getMessage());
        verify(assetMapper).selectOne(any(QueryWrapper.class));
        verify(idleAssetNoticeMapper, never()).insert(any(IdleAssetNotice.class));
    }

    @Test
    void claimAssetShouldEnterApprovalPendingState() {
        IdleAssetNotice notice = notice(9L, "PUBLISHED");
        when(idleAssetNoticeMapper.selectOne(any(QueryWrapper.class))).thenReturn(notice);

        IdleAssetNotice result = idleAssetService.claimAsset(9L, 42L);

        assertEquals("CLAIM_PENDING", result.getStatus());
        assertEquals("PENDING", result.getClaimStatus());
        assertEquals(42L, result.getClaimantId());
        verify(idleAssetNoticeMapper).updateById(result);
    }

    @Test
    void approveClaimShouldAssignAssetAfterManagerApproval() {
        IdleAssetNotice notice = notice(9L, "CLAIM_PENDING");
        notice.setAssetId(10L);
        notice.setClaimantId(42L);
        notice.setClaimStatus("PENDING");
        when(idleAssetNoticeMapper.selectOne(any(QueryWrapper.class))).thenReturn(notice);
        when(assetLifecycleService.transitionAsset(eq(10L), eq(AssetStatus.IN_USE), eq("IDLE_CLAIM_APPROVED"), anyString(), eq(99L), any()))
                .thenReturn(asset(10L, "会议室投影仪", AssetStatus.IN_USE.name()));

        IdleAssetNotice result = idleAssetService.approveClaim(9L, 99L, "同意");

        assertEquals("CLAIMED", result.getStatus());
        assertEquals("APPROVED", result.getClaimStatus());
        assertEquals(99L, result.getClaimApprovedBy());
        assertEquals("同意", result.getApprovalOpinion());
        verify(idleAssetNoticeMapper).updateById(result);
    }

    @Test
    void rejectClaimShouldReopenAnnouncement() {
        IdleAssetNotice notice = notice(9L, "CLAIM_PENDING");
        notice.setClaimStatus("PENDING");
        notice.setClaimantId(42L);
        notice.setClaimDate(java.time.LocalDate.now());
        when(idleAssetNoticeMapper.selectOne(any(QueryWrapper.class))).thenReturn(notice);

        IdleAssetNotice result = idleAssetService.rejectClaim(9L, 99L, "暂不分配");

        assertEquals("PUBLISHED", result.getStatus());
        assertEquals("REJECTED", result.getClaimStatus());
        assertEquals(null, result.getClaimantId());
        assertEquals(null, result.getClaimDate());
        assertEquals(99L, result.getClaimApprovedBy());
        assertEquals("暂不分配", result.getApprovalOpinion());
        verify(idleAssetNoticeMapper).updateById(result);
    }

    private Asset asset(Long id, String name, String status) {
        Asset asset = new Asset();
        asset.setId(id);
        asset.setTenantId("T001");
        asset.setAssetName(name);
        asset.setStatus(status);
        return asset;
    }

    private IdleAssetNotice notice(Long id, String status) {
        IdleAssetNotice notice = new IdleAssetNotice();
        notice.setId(id);
        notice.setTenantId("T001");
        notice.setStatus(status);
        return notice;
    }
}
