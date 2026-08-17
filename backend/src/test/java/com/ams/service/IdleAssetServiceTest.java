package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.IdleAssetCreateDTO;
import com.ams.entity.Asset;
import com.ams.entity.IdleAssetNotice;
import com.ams.entity.User;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.IdleAssetNoticeMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
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
    private AssetDataPermissionEvaluator assetDataPermissionEvaluator;

    @Mock
    private TenantAuthorityService tenantAuthorityService;

    @InjectMocks
    private IdleAssetService idleAssetService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "idle-test", null, List.of(
                new SimpleGrantedAuthority("idleasset:query"),
                new SimpleGrantedAuthority("idleasset:create"),
                new SimpleGrantedAuthority("idleasset:claim"))));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void listAppliesTheSharedRelatedAssetScope() {
        when(idleAssetNoticeMapper.selectPage(any(Page.class), any(QueryWrapper.class)))
                .thenReturn(new Page<>(1, 10));

        idleAssetService.queryIdleAssets(1, 10, null);

        verify(assetDataPermissionEvaluator).applyToRelatedAsset(any(QueryWrapper.class));
    }

    @Test
    void publishRejectsAssetOwnedByAnotherTenant() {
        IdleAssetCreateDTO dto = new IdleAssetCreateDTO();
        dto.setAssetId(9L);
        Asset otherTenantAsset = new Asset();
        otherTenantAsset.setId(9L);
        otherTenantAsset.setTenantId("T002");
        when(assetMapper.selectOne(any())).thenReturn(null);
        when(assetMapper.selectById(9L)).thenReturn(otherTenantAsset);

        assertThrows(AccessDeniedException.class, () -> idleAssetService.publishNotice(dto));

        verify(idleAssetNoticeMapper, never()).insert(any(IdleAssetNotice.class));
    }

    @Test
    void claimRejectsAUserIdThatDoesNotMatchTheAuthenticatedTenantMember() {
        IdleAssetNotice notice = new IdleAssetNotice();
        notice.setId(5L);
        notice.setTenantId("T001");
        notice.setAssetId(1L);
        notice.setStatus("PUBLISHED");
        Asset asset = new Asset();
        asset.setId(1L);
        asset.setTenantId("T001");
        User currentUser = new User();
        currentUser.setId(8L);
        when(idleAssetNoticeMapper.selectOne(any(QueryWrapper.class))).thenReturn(notice);
        when(assetMapper.selectOne(any())).thenReturn(asset);
        when(tenantAuthorityService.requireCurrentTenantMember()).thenReturn(currentUser);

        assertThrows(AccessDeniedException.class, () -> idleAssetService.claimAsset(5L, 7L));

        verify(idleAssetNoticeMapper, never()).update(any(), any());
    }
}
