package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SysTenantDTO;
import com.ams.entity.SysTenant;
import com.ams.mapper.SysTenantMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 租户主数据只读 catalog 服务测试。
 *
 * 注意：SysTenantMapper 故意不带 tenant_id 过滤（sys_tenant 本身就是租户表），
 * 因此 list/detail/meta 在没有 TenantContext 时也必须能正常工作（由 system:tenant:query 权限码控制可见性）。
 * 仅 current() 依赖 TenantContext（JWT 注入的当前租户）。
 */
@ExtendWith(MockitoExtension.class)
class SysTenantServiceTest {

    @Mock
    private SysTenantMapper sysTenantMapper;

    private SysTenantService service;

    @BeforeEach
    void setUp() {
        // 注意：这里故意不设置 TenantContext —— list/detail/meta 不依赖它
        service = new SysTenantService(sysTenantMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void detailShouldRejectBlankIdWithoutTouchingMapper() {
        // requireNonBlank 对 null / 空白抛业务异常，且不查 mapper
        assertThrows(BusinessException.class, () -> service.detail(null));
        assertThrows(BusinessException.class, () -> service.detail(""));
        assertThrows(BusinessException.class, () -> service.detail("   "));
        verifyNoInteractions(sysTenantMapper);
    }

    @Test
    void detailShouldTrimIdBeforeLookup() {
        when(sysTenantMapper.selectById("T001")).thenReturn(tenant("T001"));

        SysTenantDTO dto = service.detail("  T001  ");
        assertEquals("T001", dto.getId());
        verify(sysTenantMapper).selectById(eq("T001"));
    }

    @Test
    void detailShouldThrowBusinessExceptionWhenNotFound() {
        when(sysTenantMapper.selectById("T_MISSING")).thenReturn(null);
        BusinessException ex = assertThrows(BusinessException.class, () -> service.detail("T_MISSING"));
        assertEquals("租户不存在", ex.getMessage());
    }

    @Test
    void detailShouldReturnTenantMasterData() {
        SysTenant record = tenant("T001");
        when(sysTenantMapper.selectById("T001")).thenReturn(record);

        SysTenantDTO dto = service.detail("T001");
        assertEquals("T001", dto.getId());
        assertEquals("演示租户", dto.getName());
        assertEquals("PROFESSIONAL", dto.getPlan());
        assertEquals(100, dto.getMaxUsers());
        assertEquals(5000, dto.getMaxAssets());
        assertEquals("ACTIVE", dto.getStatus());
        assertEquals("王五", dto.getContactName());
    }

    @Test
    void listShouldWorkWithoutTenantContextBecauseSysTenantIsTheTenantTable() {
        // sys_tenant 故意不做 tenant_id 过滤；list/count 不依赖 TenantContext
        when(sysTenantMapper.count(eq(null), eq(null))).thenReturn(1L);
        when(sysTenantMapper.selectPage(eq(null), eq(null), eq(20), eq(0)))
                .thenReturn(List.of(tenant("T001")));

        SysTenantDTO.PageResult result = service.list(null, null, 1, 20);
        assertEquals(1, result.getTotal());
        assertEquals(1, result.getRecords().size());
        assertEquals("T001", result.getRecords().get(0).getId());
    }

    @Test
    void listShouldClampPaginationBounds() {
        when(sysTenantMapper.count(eq(null), eq(null))).thenReturn(0L);
        when(sysTenantMapper.selectPage(eq(null), eq(null), eq(20), eq(0)))
                .thenReturn(List.of());

        // page<=0 → offset 0；pageSize<=0 → 20
        SysTenantDTO.PageResult result = service.list(null, null, -5, 0);
        assertEquals(0, result.getTotal());
        assertEquals(0, result.getRecords().size());
    }

    @Test
    void listShouldClampPageSizeTo100() {
        when(sysTenantMapper.count(eq(null), eq(null))).thenReturn(0L);
        when(sysTenantMapper.selectPage(eq(null), eq(null), eq(100), eq(0)))
                .thenReturn(List.of());

        // pageSize>100 → 100
        service.list(null, null, 1, 99999);
    }

    @Test
    void listShouldComputeOffsetFromSanitizedPage() {
        when(sysTenantMapper.count(eq("T"), eq("ACTIVE"))).thenReturn(9L);
        when(sysTenantMapper.selectPage(eq("T"), eq("ACTIVE"), eq(10), eq(10)))
                .thenReturn(List.of(tenant("T002")));

        // page=2, pageSize=10 → offset=(2-1)*10=10
        SysTenantDTO.PageResult result = service.list("T", "ACTIVE", 2, 10);
        assertEquals(9, result.getTotal());
        assertEquals("T002", result.getRecords().get(0).getId());
    }

    @Test
    void metaShouldWorkWithoutTenantContextAndAdvertisePlansStatuses() {
        SysTenantDTO.Meta meta = service.meta();
        assertEquals(List.of("STANDARD", "PROFESSIONAL", "ENTERPRISE"), meta.getPlans());
        assertEquals(List.of("ACTIVE", "SUSPENDED"), meta.getStatuses());
        assertTrue(meta.getReadOnlyNotice().contains("只读 catalog"));
    }

    @Test
    void currentShouldReturnTenantFromTenantContext() {
        TenantContext.setTenantId("T001");
        when(sysTenantMapper.selectById("T001")).thenReturn(tenant("T001"));

        SysTenantDTO dto = service.current();
        assertEquals("T001", dto.getId());
        assertEquals("演示租户", dto.getName());
        verify(sysTenantMapper).selectById(eq("T001"));
    }

    @Test
    void currentShouldFailWhenTenantContextMissing() {
        // TenantContext 未设置 → BusinessException（非 AccessDeniedException，业务校验语义）
        BusinessException ex = assertThrows(BusinessException.class, () -> service.current());
        assertEquals("未获取到当前租户", ex.getMessage());
        verifyNoInteractions(sysTenantMapper);
    }

    @Test
    void currentShouldFailWhenTenantContextSetButMasterDataMissing() {
        TenantContext.setTenantId("T_GHOST");
        when(sysTenantMapper.selectById("T_GHOST")).thenReturn(null);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.current());
        assertEquals("当前租户主数据不存在", ex.getMessage());
    }

    private SysTenant tenant(String id) {
        SysTenant record = new SysTenant();
        record.setId(id);
        record.setName("演示租户");
        record.setPlan("PROFESSIONAL");
        record.setMaxUsers(100);
        record.setMaxAssets(5000);
        record.setStatus("ACTIVE");
        record.setContactName("王五");
        record.setContactPhone("13800000000");
        record.setContactEmail("admin@example.com");
        record.setCreatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));
        record.setUpdatedAt(LocalDateTime.of(2026, 7, 23, 0, 0));
        return record;
    }
}
