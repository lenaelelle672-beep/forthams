package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.TodoFieldConfigDTO;
import com.ams.dto.TodoFieldOperationDTO;
import com.ams.dto.TodoFieldPreviewDTO;
import com.ams.dto.TodoFieldRoleOverrideDTO;
import com.ams.dto.TodoFieldSaveDTO;
import com.ams.entity.TodoFieldConfig;
import com.ams.entity.TodoFieldRoleOverride;
import com.ams.mapper.TodoFieldConfigMapper;
import com.ams.mapper.TodoFieldRoleOverrideMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TodoFieldConfigServiceTest {

    @Mock
    private TodoFieldConfigMapper todoFieldConfigMapper;

    @Mock
    private TodoFieldRoleOverrideMapper todoFieldRoleOverrideMapper;

    private TodoFieldConfigService todoFieldConfigService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        todoFieldConfigService = new TodoFieldConfigService(todoFieldConfigMapper, todoFieldRoleOverrideMapper);
        lenient().when(todoFieldConfigMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        lenient().when(todoFieldRoleOverrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldListDefaultFieldsAndPreviewSensitiveFieldsMaskedForRegularRole() {
        List<TodoFieldConfigDTO> fields = todoFieldConfigService.listFields(null);
        assertEquals(9, fields.size());
        assertEquals("processName", fields.get(0).getFieldKey());

        TodoFieldPreviewDTO preview = todoFieldConfigService.preview("USER");
        assertTrue(preview.getReadOnly());
        assertTrue(preview.getTenantScoped());
        assertTrue(preview.getVisibleFields().stream().noneMatch(field -> "applicantName".equals(field.getFieldKey())));
        assertTrue(preview.getMaskedFields().stream().allMatch(field -> "******".equals(field.getMaskedValue())));
    }

    @Test
    void shouldSaveFieldsAndRejectDuplicateSortPrototypeAndMissingAuditPayload() {
        todoFieldConfigService.saveFields(saveDto(List.of(field("processName", 10, true, false), field("form.assetNo", 20, true, false))));

        ArgumentCaptor<TodoFieldConfig> captor = ArgumentCaptor.forClass(TodoFieldConfig.class);
        verify(todoFieldConfigMapper, atLeastOnce()).insert(captor.capture());
        assertEquals("T001", captor.getAllValues().get(0).getTenantId());
        assertEquals("processName", captor.getAllValues().get(0).getFieldKey());

        assertThrows(BusinessException.class, () -> todoFieldConfigService.saveFields(saveDto(List.of(field("processName", 10, true, false), field("processName", 20, true, false)))));
        assertThrows(BusinessException.class, () -> todoFieldConfigService.saveFields(saveDto(List.of(field("processName", 0, true, false)))));
        assertThrows(BusinessException.class, () -> todoFieldConfigService.saveFields(saveDto(List.of(field("__proto__", 10, true, false)))));
        TodoFieldSaveDTO missingAudit = saveDto(List.of(field("processName", 10, true, false)));
        missingAudit.setReason(null);
        missingAudit.setAuditEvidence(null);
        assertThrows(BusinessException.class, () -> todoFieldConfigService.saveFields(missingAudit));
    }

    @Test
    void shouldSaveStableSortAndRejectUnknownRoleOrSensitiveOverride() {
        TodoFieldConfig applicant = config("applicantName", "申请人", true, 30, true);
        TodoFieldRoleOverride override = new TodoFieldRoleOverride();
        override.setTenantId("T001");
        override.setRoleCode("AUDITOR");
        override.setFieldKey("applicantName");
        override.setOverrideVisible(true);
        override.setOverrideSortOrder(10);
        override.setExplanation("角色覆盖来源：overridden");
        when(todoFieldConfigMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(applicant));
        when(todoFieldRoleOverrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(), List.of(override));

        assertThrows(BusinessException.class, () -> todoFieldConfigService.saveRoleOverride("UNKNOWN_ROLE", roleDto("UNKNOWN_ROLE", List.of(field("applicantName", 10, true, true)))));
        assertThrows(BusinessException.class, () -> todoFieldConfigService.saveRoleOverride("APPROVER", roleDto("APPROVER", List.of(field("applicantName", 10, true, true)))));

        List<TodoFieldConfigDTO> overridden = todoFieldConfigService.saveRoleOverride("AUDITOR", roleDto("AUDITOR", List.of(field("applicantName", 10, true, true))));
        assertEquals("overridden", overridden.get(0).getSource());
        verify(todoFieldRoleOverrideMapper).insert(any(TodoFieldRoleOverride.class));

        TodoFieldSaveDTO sort = saveDto(List.of(field("applicantName", 5, true, true)));
        List<TodoFieldConfigDTO> sorted = todoFieldConfigService.saveSortOrder(sort);
        assertEquals(5, sorted.get(0).getSortOrder());
    }

    @Test
    void shouldResetDefaultsWithoutPhysicalRemovalAndRequireTenant() {
        List<TodoFieldConfigDTO> defaults = todoFieldConfigService.resetDefaults(operation());
        assertEquals(9, defaults.size());
        verify(todoFieldConfigMapper, atLeastOnce()).insert(any(TodoFieldConfig.class));

        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> todoFieldConfigService.preview("USER"));
    }

    private TodoFieldSaveDTO saveDto(List<TodoFieldConfigDTO> fields) {
        TodoFieldSaveDTO dto = new TodoFieldSaveDTO();
        dto.setConfirmed(true);
        dto.setOperatorId(42L);
        dto.setReason("待办字段复核");
        dto.setFields(fields);
        return dto;
    }

    private TodoFieldRoleOverrideDTO roleDto(String roleCode, List<TodoFieldConfigDTO> fields) {
        TodoFieldRoleOverrideDTO dto = new TodoFieldRoleOverrideDTO();
        dto.setRoleCode(roleCode);
        dto.setConfirmed(true);
        dto.setOperatorId(42L);
        dto.setReason("角色覆盖复核");
        dto.setFields(fields);
        return dto;
    }

    private TodoFieldOperationDTO operation() {
        TodoFieldOperationDTO dto = new TodoFieldOperationDTO();
        dto.setConfirmed(true);
        dto.setOperatorId(42L);
        dto.setReason("默认恢复复核");
        dto.setAuditEvidence("TODO_FIELD_GATE");
        return dto;
    }

    private TodoFieldConfigDTO field(String key, int sortOrder, boolean visible, boolean sensitive) {
        TodoFieldConfigDTO dto = new TodoFieldConfigDTO();
        dto.setFieldKey(key);
        dto.setFieldLabel(key);
        dto.setVisible(visible);
        dto.setSortOrder(sortOrder);
        dto.setSensitive(sensitive);
        return dto;
    }

    private TodoFieldConfig config(String key, String label, boolean visible, int sortOrder, boolean sensitive) {
        TodoFieldConfig config = new TodoFieldConfig();
        config.setId(1L);
        config.setTenantId("T001");
        config.setFieldKey(key);
        config.setFieldLabel(label);
        config.setVisible(visible);
        config.setSortOrder(sortOrder);
        config.setSensitive(sensitive);
        config.setDefaultField(true);
        config.setDeleted(0);
        return config;
    }
}
