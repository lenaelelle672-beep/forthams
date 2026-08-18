package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.Role;
import com.ams.mapper.RoleMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoleServiceDataScopeTest {

    @Mock
    private RoleMapper roleMapper;

    private RoleService roleService;

    @BeforeEach
    void setUp() {
        roleService = new RoleService(roleMapper);
    }

    @Test
    void updateDataScopeShouldPersistNormalizedValue() {
        Role role = new Role();
        role.setId(8L);
        role.setRoleName("专员");
        role.setDataScope("ALL");
        when(roleMapper.selectById(8L)).thenReturn(role);

        roleService.updateDataScope(8L, " self ");

        ArgumentCaptor<Role> captor = ArgumentCaptor.forClass(Role.class);
        verify(roleMapper).updateById(captor.capture());
        assertEquals("SELF", captor.getValue().getDataScope());
    }

    @Test
    void updateDataScopeShouldRejectUnknownValue() {
        Role role = new Role();
        role.setId(8L);
        when(roleMapper.selectById(8L)).thenReturn(role);

        assertThrows(BusinessException.class, () -> roleService.updateDataScope(8L, "WAT"));
    }
}
