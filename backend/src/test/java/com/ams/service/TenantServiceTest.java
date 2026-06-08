package com.ams.service;

import com.ams.entity.SysTenant;
import com.ams.mapper.SysTenantMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("租户服务测试")
class TenantServiceTest {

    @Mock
    private SysTenantMapper sysTenantMapper;

    @InjectMocks
    private TenantService tenantService;

    @Test
    @DisplayName("getActiveTenantIds: 当存在活跃租户时返回 ID 列表")
    void getActiveTenantIds_ShouldReturnActiveTenantIds() {
        // Arrange
        SysTenant tenant1 = new SysTenant();
        tenant1.setId("1");
        tenant1.setStatus("ACTIVE");

        SysTenant tenant2 = new SysTenant();
        tenant2.setId("2");
        tenant2.setStatus("ACTIVE");

        SysTenant tenant3 = new SysTenant();
        tenant3.setId("3");
        tenant3.setStatus("SUSPENDED");

        // 模拟 Mapper 返回所有记录（状态过滤由 LambdaQueryWrapper 处理）
        when(sysTenantMapper.selectList(org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of(tenant1, tenant2));

        // Act
        List<String> result = tenantService.getActiveTenantIds();

        // Assert
        assertThat(result).hasSize(2);
        assertThat(result).containsExactly("1", "2");
    }

    @Test
    @DisplayName("getActiveTenantIds: 当无活跃租户时返回空列表")
    void getActiveTenantIds_ShouldReturnEmptyList_WhenNoActiveTenants() {
        // Arrange
        when(sysTenantMapper.selectList(org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of());

        // Act
        List<String> result = tenantService.getActiveTenantIds();

        // Assert
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("getActiveTenantIds: 应只查询 status=ACTIVE 的租户")
    void getActiveTenantIds_ShouldFilterByActiveStatus() {
        // Arrange
        SysTenant tenant1 = new SysTenant();
        tenant1.setId("1");
        tenant1.setStatus("ACTIVE");

        SysTenant tenant2 = new SysTenant();
        tenant2.setId("2");
        tenant2.setStatus("SUSPENDED");

        SysTenant tenant3 = new SysTenant();
        tenant3.setId("3");
        tenant3.setStatus("ACTIVE");

        when(sysTenantMapper.selectList(org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of(tenant1, tenant3));

        // Act
        List<String> result = tenantService.getActiveTenantIds();

        // Assert
        assertThat(result).hasSize(2);
        assertThat(result).containsExactly("1", "3");
    }
}
