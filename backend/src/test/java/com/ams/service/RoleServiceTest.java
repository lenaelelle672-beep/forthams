package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.RoleDataScopeUpdateDTO;
import com.ams.entity.Dept;
import com.ams.entity.GeneralAuditEntry;
import com.ams.entity.Role;
import com.ams.entity.RoleDataScopeRule;
import com.ams.entity.RoleDept;
import com.ams.entity.User;
import com.ams.mapper.AuditLogMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleDataScopeMapper;
import com.ams.mapper.RoleDeptMapper;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.UserRoleMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoleServiceTest {

    @Mock
    private RoleMapper roleMapper;

    @Mock
    private RoleDataScopeMapper roleDataScopeMapper;

    @Mock
    private RoleDeptMapper roleDeptMapper;

    @Mock
    private DeptMapper deptMapper;

    @Mock
    private UserRoleMapper userRoleMapper;

    @Mock
    private TenantAuthorityService tenantAuthorityService;

    @Mock
    private AuditLogMapper auditLogMapper;

    @InjectMocks
    private RoleService roleService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void customScopePersistsOnlyCurrentTenantActiveDepartments() {
        TenantContext.setTenantId("T001");
        when(tenantAuthorityService.requireTenantAdmin()).thenReturn(operator());
        when(roleMapper.selectOne(any(QueryWrapper.class))).thenReturn(role(5L));
        when(deptMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(dept(10L), dept(11L)));
        when(roleDataScopeMapper.selectOne(any(QueryWrapper.class))).thenReturn(null);
        when(auditLogMapper.insertAuditEntry(any(GeneralAuditEntry.class))).thenReturn(1);
        RoleDataScopeUpdateDTO dto = new RoleDataScopeUpdateDTO();
        dto.setDataScope("CUSTOM");
        dto.setDeptIds(List.of(10L, 11L));

        roleService.configureDataScope(5L, dto);

        ArgumentCaptor<RoleDataScopeRule> ruleCaptor = ArgumentCaptor.forClass(RoleDataScopeRule.class);
        verify(roleDataScopeMapper).insert(ruleCaptor.capture());
        assertThat(ruleCaptor.getValue().getTenantId()).isEqualTo("T001");
        assertThat(ruleCaptor.getValue().getRoleId()).isEqualTo(5L);
        assertThat(ruleCaptor.getValue().getDataScope()).isEqualTo("CUSTOM");
        ArgumentCaptor<RoleDept> associationCaptor = ArgumentCaptor.forClass(RoleDept.class);
        verify(roleDeptMapper, org.mockito.Mockito.times(2)).insert(associationCaptor.capture());
        assertThat(associationCaptor.getAllValues())
                .allSatisfy(association -> {
                    assertThat(association.getTenantId()).isEqualTo("T001");
                    assertThat(association.getRoleId()).isEqualTo(5L);
                });
    }

    @Test
    void customScopeRejectsMissingOrCrossTenantDepartmentsBeforeWritingRules() {
        TenantContext.setTenantId("T001");
        when(tenantAuthorityService.requireTenantAdmin()).thenReturn(operator());
        when(roleMapper.selectOne(any(QueryWrapper.class))).thenReturn(role(5L));
        when(deptMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());
        RoleDataScopeUpdateDTO dto = new RoleDataScopeUpdateDTO();
        dto.setDataScope("CUSTOM");
        dto.setDeptIds(List.of(99L));

        assertThatThrownBy(() -> roleService.configureDataScope(5L, dto))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("CUSTOM 部门");

        verifyNoInteractions(roleDataScopeMapper, roleDeptMapper);
    }

    @Test
    void customScopeRejectsDuplicateDepartmentInputBeforeWritingRules() {
        TenantContext.setTenantId("T001");
        when(tenantAuthorityService.requireTenantAdmin()).thenReturn(operator());
        when(roleMapper.selectOne(any(QueryWrapper.class))).thenReturn(role(5L));
        RoleDataScopeUpdateDTO dto = new RoleDataScopeUpdateDTO();
        dto.setDataScope("CUSTOM");
        dto.setDeptIds(List.of(10L, 10L));

        assertThatThrownBy(() -> roleService.configureDataScope(5L, dto))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("重复");

        verifyNoInteractions(deptMapper, roleDataScopeMapper, roleDeptMapper);
    }

    @Test
    void customScopeWritesTenantScopedAuditWithoutRawPayload() {
        TenantContext.setTenantId("T001");
        when(tenantAuthorityService.requireTenantAdmin()).thenReturn(operator());
        when(roleMapper.selectOne(any(QueryWrapper.class))).thenReturn(role(5L));
        when(deptMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(dept(11L)));
        RoleDataScopeRule existingRule = new RoleDataScopeRule();
        existingRule.setId(3L);
        existingRule.setTenantId("T001");
        existingRule.setRoleId(5L);
        existingRule.setDataScope("ALL");
        when(roleDataScopeMapper.selectOne(any(QueryWrapper.class))).thenReturn(existingRule);
        RoleDept oldAssociation = new RoleDept();
        oldAssociation.setDeptId(10L);
        when(roleDeptMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(oldAssociation));
        when(auditLogMapper.insertAuditEntry(any(GeneralAuditEntry.class))).thenReturn(1);
        RoleDataScopeUpdateDTO dto = new RoleDataScopeUpdateDTO();
        dto.setDataScope("CUSTOM");
        dto.setDeptIds(List.of(11L));

        roleService.configureDataScope(5L, dto);

        ArgumentCaptor<GeneralAuditEntry> captor = ArgumentCaptor.forClass(GeneralAuditEntry.class);
        verify(auditLogMapper).insertAuditEntry(captor.capture());
        GeneralAuditEntry audit = captor.getValue();
        assertThat(audit.getTenantId()).isEqualTo("T001");
        assertThat(audit.getOperatorId()).isEqualTo(7L);
        assertThat(audit.getBeforeRecord()).isEqualTo("scope=ALL;customDeptIds=[10]");
        assertThat(audit.getAfterRecord()).isEqualTo("scope=CUSTOM;customDeptIds=[11]");
        assertThat(audit.getRawPayload()).isNull();
    }

    @Test
    void dataScopeUpdateFailsClosedWhenAuditCannotBeWritten() {
        TenantContext.setTenantId("T001");
        when(tenantAuthorityService.requireTenantAdmin()).thenReturn(operator());
        when(roleMapper.selectOne(any(QueryWrapper.class))).thenReturn(role(5L));
        when(roleDataScopeMapper.selectOne(any(QueryWrapper.class))).thenReturn(null);
        when(auditLogMapper.insertAuditEntry(any(GeneralAuditEntry.class))).thenReturn(0);
        RoleDataScopeUpdateDTO dto = new RoleDataScopeUpdateDTO();
        dto.setDataScope("ALL");

        assertThatThrownBy(() -> roleService.configureDataScope(5L, dto))
                .isInstanceOf(BusinessException.class)
                .hasMessage("数据权限审计写入失败");
    }

    private Role role(Long id) {
        Role role = new Role();
        role.setId(id);
        role.setTenantId("T001");
        role.setStatus(1);
        return role;
    }

    private Dept dept(Long id) {
        Dept dept = new Dept();
        dept.setId(id);
        dept.setTenantId("T001");
        dept.setStatus("1");
        return dept;
    }

    private User operator() {
        User user = new User();
        user.setId(7L);
        user.setUsername("tenant-admin");
        return user;
    }
}
