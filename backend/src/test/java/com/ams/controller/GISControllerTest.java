package com.ams.controller;

import com.ams.common.Result;
import com.ams.context.TenantContext;
import com.ams.dto.GisLocationUpdateRequest;
import com.ams.entity.Asset;
import com.ams.entity.Location;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.LocationMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GISControllerTest {

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private LocationMapper locationMapper;

    private GISController controller;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
        controller = new GISController(assetMapper, locationMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void getAssetsShouldReturnOnlyMappedAssetsForAuthorizedUser() {
        Asset asset = asset(35L, "IN_USE", 8L);
        when(assetMapper.selectList(any())).thenReturn(List.of(asset));

        Result<List<Asset>> result = controller.getAssetsWithLocation(
                null, null, null, null, superAdmin());

        assertThat(result.getCode()).isEqualTo(200);
        assertThat(result.getData()).containsExactly(asset);
        verify(assetMapper).selectList(any());
        verifyNoInteractions(locationMapper);
    }

    @Test
    void getAssetsShouldResolveSelectedLocationAndItsChildren() {
        Location root = new Location();
        root.setId(5L);
        Location child = new Location();
        child.setId(6L);
        when(locationMapper.findDescendants(5L)).thenReturn(List.of(root, child));
        when(assetMapper.selectList(any())).thenReturn(List.of(asset(36L, "IDLE", 8L)));

        Result<List<Asset>> result = controller.getAssetsWithLocation(
                null, null, null, 5L, superAdmin());

        assertThat(result.getData()).hasSize(1);
        verify(locationMapper).findDescendants(5L);
        verify(assetMapper).selectList(any());
    }

    @Test
    void getStatsShouldGroupMappedAssets() {
        when(assetMapper.selectList(any())).thenReturn(List.of(
                asset(35L, "IN_USE", 8L),
                asset(36L, "IN_USE", 8L),
                asset(37L, "IDLE", 9L)));

        Result<Map<String, Object>> result = controller.getStats(superAdmin());

        assertThat(result.getData()).containsEntry("total", 3);
        assertThat(result.getData()).containsEntry("byStatus", Map.of("IN_USE", 2L, "IDLE", 1L));
        assertThat(result.getData()).containsEntry("byCategory", Map.of("8", 2L, "9", 1L));
    }

    @Test
    void getAssetsShouldRejectUsersWithoutAssetQueryPermission() {
        assertThatThrownBy(() -> controller.getAssetsWithLocation(
                null, null, null, null, userWith("asset:edit")))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("asset:query");

        verifyNoInteractions(assetMapper, locationMapper);
    }

    @Test
    void updateLocationShouldPersistCoordinatesWithinCurrentTenant() {
        GisLocationUpdateRequest request = new GisLocationUpdateRequest();
        request.setLat(new BigDecimal("30.2812"));
        request.setLng(new BigDecimal("120.1480"));
        when(assetMapper.update(any(Asset.class), any())).thenReturn(1);

        Result<Void> result = controller.updateLocation(36L, request, superAdmin());

        ArgumentCaptor<Asset> assetCaptor = ArgumentCaptor.forClass(Asset.class);
        verify(assetMapper).update(assetCaptor.capture(), any());
        assertThat(result.getCode()).isEqualTo(200);
        assertThat(assetCaptor.getValue().getLocationLat()).isEqualByComparingTo("30.2812");
        assertThat(assetCaptor.getValue().getLocationLng()).isEqualByComparingTo("120.1480");
    }

    private Asset asset(Long id, String status, Long categoryId) {
        Asset asset = new Asset();
        asset.setId(id);
        asset.setAssetNo("PT-ASSET-" + id);
        asset.setStatus(status);
        asset.setCategoryId(categoryId);
        asset.setLocationLat(new BigDecimal("30.2812"));
        asset.setLocationLng(new BigDecimal("120.1480"));
        asset.setTenantId("dept:1");
        return asset;
    }

    private Authentication superAdmin() {
        return userWith("ROLE_SUPER_ADMIN");
    }

    private Authentication userWith(String authority) {
        return new UsernamePasswordAuthenticationToken(
                "admin", "n/a", List.of(new SimpleGrantedAuthority(authority)));
    }
}
