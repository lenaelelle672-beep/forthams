package com.ams.config;

import com.ams.context.TenantContext;
import com.ams.datascope.DataScopeDecisionService;
import com.ams.datascope.DataScopeTableRegistry;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.SysRoleDeptMapper;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.handler.TenantLineHandler;
import com.baomidou.mybatisplus.extension.plugins.inner.DataPermissionInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.InnerInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.OptimisticLockerInnerInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.TenantLineInnerInterceptor;
import net.sf.jsqlparser.schema.Column;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
class MyBatisPlusConfigTest {

    @Mock
    private DataScopeDecisionService decisionService;

    @Mock
    private DataScopeTableRegistry tableRegistry;

    @Mock
    private ObjectProvider<DeptMapper> deptMapper;

    @Mock
    private ObjectProvider<RoleMapper> roleMapper;

    @Mock
    private ObjectProvider<SysRoleDeptMapper> sysRoleDeptMapper;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldRegisterOptimisticLockerDataPermissionPaginationAndTenantInterceptorsInOrder() {
        MybatisPlusInterceptor interceptor = new MyBatisPlusConfig().mybatisPlusInterceptor(
                decisionService,
                tableRegistry,
                deptMapper,
                roleMapper,
                sysRoleDeptMapper);

        List<InnerInterceptor> interceptors = interceptor.getInterceptors();

        assertEquals(4, interceptors.size());
        assertInstanceOf(OptimisticLockerInnerInterceptor.class, interceptors.get(0));
        assertInstanceOf(DataPermissionInterceptor.class, interceptors.get(1));
        assertInstanceOf(PaginationInnerInterceptor.class, interceptors.get(2));
        assertInstanceOf(TenantLineInnerInterceptor.class, interceptors.get(3));
    }

    @Test
    void tenantLineHandlerShouldUseStringTenantIdAndDocumentedTableWhitelist() {
        TenantLineHandler handler = tenantLineHandler();
        TenantContext.setTenantId("dept:42");

        assertEquals("'dept:42'", handler.getTenantId().toString());
        assertEquals("tenant_id", handler.getTenantIdColumn());
        assertTrue(handler.ignoreTable("sys_user"));
        assertTrue(handler.ignoreTable("sys_tenant"));
        assertTrue(handler.ignoreTable("QRTZ_TRIGGERS"));
        assertTrue(handler.ignoreTable("location"));
        assertTrue(handler.ignoreTable("asset_category"));
        assertTrue(handler.ignoreTable("vendor"));
        assertTrue(handler.ignoreTable("contract"));
        assertTrue(handler.ignoreTable("workflow_node"));
        assertTrue(handler.ignoreTable("workflow_edge"));
        assertTrue(handler.ignoreTable("sys_permission"));
        assertTrue(handler.ignoreTable("sys_oauth_config"));
        assertTrue(handler.ignoreTable("sys_webhook_config"));
        assertTrue(handler.ignoreTable("sys_channel_config"));
        assertTrue(handler.ignoreTable("sys_custom_field"));
        assertTrue(handler.ignoreTable("sys_custom_fieldset"));
        assertTrue(handler.ignoreTable("sys_custom_fieldset_field"));
        assertTrue(handler.ignoreTable("bpm_mail_variable"));
        assertFalse(handler.ignoreTable("asset"));
        assertFalse(handler.ignoreTable("work_order"));
        assertFalse(handler.ignoreTable("workflow_definition"));
        assertFalse(handler.ignoreTable("purchase_order"));
        assertFalse(handler.ignoreTable("asset_usage_log"));
        assertFalse(handler.ignoreTable("sys_custom_field_value"));
    }

    @Test
    void tenantLineHandlerShouldOnlyIgnoreTenantInsertWhenColumnAlreadyExists() {
        TenantLineHandler handler = tenantLineHandler();

        TenantContext.clear();
        assertTrue(handler.ignoreInsert(List.of(new Column("tenant_id")), "tenant_id"));
        assertThrows(AccessDeniedException.class, handler::getTenantId);

        TenantContext.setTenantId("dept:42");
        assertTrue(handler.ignoreInsert(List.of(new Column("tenant_id")), "tenant_id"));
        assertFalse(handler.ignoreInsert(List.of(new Column("asset_no"), new Column("asset_name")), "tenant_id"));
        assertFalse(handler.ignoreInsert(List.of(), "tenant_id"));
        assertFalse(handler.ignoreInsert(null, "tenant_id"));
        assertEquals("'dept:42'", handler.getTenantId().toString());
    }

    private TenantLineHandler tenantLineHandler() {
        MybatisPlusInterceptor interceptor = new MyBatisPlusConfig().mybatisPlusInterceptor(
                decisionService,
                tableRegistry,
                deptMapper,
                roleMapper,
                sysRoleDeptMapper);
        TenantLineInnerInterceptor tenantInterceptor =
                (TenantLineInnerInterceptor) interceptor.getInterceptors().get(3);
        return tenantInterceptor.getTenantLineHandler();
    }
}
