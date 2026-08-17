package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.RoleDataScopeRule;
import com.ams.entity.RoleDept;
import com.ams.entity.User;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleDataScopeMapper;
import com.ams.mapper.RoleDeptMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssetDataPermissionEvaluatorTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private RoleDataScopeMapper roleDataScopeMapper;

    @Mock
    private RoleDeptMapper roleDeptMapper;

    @Mock
    private DeptMapper deptMapper;

    @Mock
    private TenantAuthorityService tenantAuthorityService;

    @Mock
    private UserTenantMembershipMapper userTenantMembershipMapper;

    @InjectMocks
    private AssetDataPermissionEvaluator evaluator;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void duplicateCustomDepartmentAssociationFailsClosedDuringExecution() {
        TenantContext.setTenantId("T001");
        User user = new User();
        user.setId(1L);
        user.setTenantId("T001");
        when(tenantAuthorityService.requireCurrentTenantMember()).thenReturn(user);

        RoleDataScopeRule rule = new RoleDataScopeRule();
        rule.setTenantId("T001");
        rule.setRoleId(2L);
        rule.setDataScope("CUSTOM");
        when(roleDataScopeMapper.selectByUserIdAndTenantId(1L, "T001")).thenReturn(List.of(rule));

        RoleDept duplicate = new RoleDept();
        duplicate.setTenantId("T001");
        duplicate.setRoleId(2L);
        duplicate.setDeptId(10L);
        when(roleDeptMapper.selectByTenantIdAndRoleIds("T001", List.of(2L)))
                .thenReturn(List.of(duplicate, duplicate));

        assertThatThrownBy(() -> evaluator.applyTo(new LambdaQueryWrapper<Asset>()))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("关联重复");
    }

    @Test
    void writingAnAssetRejectsTargetUserWithoutActiveTenantMembership() {
        TenantContext.setTenantId("T001");
        User currentUser = new User();
        currentUser.setId(1L);
        currentUser.setTenantId("T001");
        when(tenantAuthorityService.requireCurrentTenantMember()).thenReturn(currentUser);

        RoleDataScopeRule allScope = new RoleDataScopeRule();
        allScope.setTenantId("T001");
        allScope.setRoleId(2L);
        allScope.setDataScope("ALL");
        when(roleDataScopeMapper.selectByUserIdAndTenantId(1L, "T001")).thenReturn(List.of(allScope));

        User targetUser = new User();
        targetUser.setId(3L);
        targetUser.setTenantId("T001");
        targetUser.setStatus(1);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(targetUser);
        when(userTenantMembershipMapper.countActiveMembership(3L, "T001")).thenReturn(0L);

        Asset asset = new Asset();
        asset.setTenantId("T001");
        asset.setUserId(3L);

        assertThatThrownBy(() -> evaluator.assertCanWrite(asset))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("未加入当前租户");
    }

    @Test
    void approvalProcessScopeUsesOnlyThePermittedProcessTypes() {
        TenantContext.setTenantId("T001");
        User user = new User();
        user.setId(1L);
        user.setTenantId("T001");
        when(tenantAuthorityService.requireCurrentTenantMember()).thenReturn(user);

        RoleDataScopeRule allScope = new RoleDataScopeRule();
        allScope.setTenantId("T001");
        allScope.setRoleId(2L);
        allScope.setDataScope("ALL");
        when(roleDataScopeMapper.selectByUserIdAndTenantId(1L, "T001")).thenReturn(List.of(allScope));

        QueryWrapper<ApprovalProcess> wrapper = new QueryWrapper<>();
        evaluator.applyToApprovalProcesses(wrapper, Set.of("COMPENSATION", "DISPOSAL"));

        assertThat(wrapper.getSqlSegment())
                .contains("asset_compensation")
                .contains("disposal_application")
                .doesNotContain("retirement_application")
                .doesNotContain("work_order");
    }
}
