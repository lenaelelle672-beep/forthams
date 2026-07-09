package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.FormDefinitionDTO;
import com.ams.dto.FormDefinitionOperationDTO;
import com.ams.dto.FormDefinitionPreviewDTO;
import com.ams.dto.FormDefinitionSaveDTO;
import com.ams.dto.FormDefinitionSchemaValidationResultDTO;
import com.ams.entity.FormDefinition;
import com.ams.entity.FormDefinitionVersion;
import com.ams.mapper.FormDefinitionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FormDefinitionServiceTest {

    @Mock
    private FormDefinitionMapper formDefinitionMapper;

    @Mock
    private JdbcTemplate jdbcTemplate;

    private FormDefinitionService formDefinitionService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        formDefinitionService = new FormDefinitionService(formDefinitionMapper, new ObjectMapper(), jdbcTemplate);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldSanitizeSchemaAndCreateDraftForCurrentTenant() {
        when(formDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        FormDefinitionDTO saved = formDefinitionService.saveDraft("ASSET_FORM", saveDto(validDangerousSchema(), 7L));

        ArgumentCaptor<FormDefinition> captor = ArgumentCaptor.forClass(FormDefinition.class);
        verify(formDefinitionMapper).insert(captor.capture());
        FormDefinition definition = captor.getValue();
        assertEquals("T001", definition.getTenantId());
        assertEquals("ASSET_FORM", definition.getFormKey());
        assertEquals("DRAFT", definition.getStatus());
        assertEquals(0, definition.getVersion());
        assertEquals(7L, definition.getUpdatedBy());
        assertFalse(definition.getSchemaJson().contains("onClick"));
        assertFalse(definition.getSchemaJson().contains("<script"));
        assertFalse(definition.getSchemaJson().contains("source"));
        assertFalse(definition.getSchemaJson().contains("13800138000"));
        assertTrue(definition.getSchemaJson().contains("******"));
        assertEquals("DRAFT", saved.getStatus());
    }

    @Test
    void shouldRejectDuplicateFieldKeyAndIllegalType() {
        FormDefinitionSchemaValidationResultDTO validation = formDefinitionService.validateSchema(Map.of(
                "sections", List.of(Map.of(
                        "sectionKey", "basic",
                        "label", "基础信息",
                        "fields", List.of(
                                Map.of("fieldKey", "assetNo", "label", "资产编号", "type", "text"),
                                Map.of("fieldKey", "assetNo", "label", "重复资产编号", "type", "shell")
                        )
                ))
        ));

        assertFalse(validation.isValid());
        assertTrue(validation.getErrors().stream().anyMatch(error -> error.contains("fieldKey 重复")));
        assertTrue(validation.getErrors().stream().anyMatch(error -> error.contains("非法字段类型")));
    }

    @Test
    void shouldPublishDraftAndAppendImmutableVersionSnapshot() {
        FormDefinition definition = definition("DRAFT", 0);
        when(formDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        FormDefinitionDTO published = formDefinitionService.publish("ASSET_FORM", operation(11L));

        assertEquals("PUBLISHED", published.getStatus());
        assertEquals(1, published.getVersion());
        assertEquals(11L, definition.getPublishedBy());
        assertNotNull(definition.getPublishedAt());
        verify(formDefinitionMapper).updateById(definition);
        verify(jdbcTemplate).update(contains("INSERT INTO form_definition_version"), any(Object[].class));
    }

    @Test
    void shouldDisableOnlyPublishedDefinitionAndAppendSnapshot() {
        FormDefinition definition = definition("PUBLISHED", 1);
        when(formDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        FormDefinitionDTO disabled = formDefinitionService.disable("ASSET_FORM", operation(11L));

        assertEquals("DISABLED", disabled.getStatus());
        assertEquals(2, disabled.getVersion());
        verify(formDefinitionMapper).updateById(definition);
        verify(jdbcTemplate).update(contains("INSERT INTO form_definition_version"), any(Object[].class));
    }

    @Test
    void shouldRollbackToVersionSnapshotAndAppendNewSnapshot() {
        FormDefinition definition = definition("DISABLED", 2);
        FormDefinitionVersion sourceVersion = version(1, validSchemaJson());
        when(formDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), eq("T001"), eq("ASSET_FORM"), eq(1)))
                .thenReturn(List.of(sourceVersion));

        FormDefinitionDTO rolledBack = formDefinitionService.rollback("ASSET_FORM", 1, operation(12L));

        assertEquals("PUBLISHED", rolledBack.getStatus());
        assertEquals(3, rolledBack.getVersion());
        assertEquals(12L, definition.getPublishedBy());
        verify(formDefinitionMapper).updateById(definition);
        verify(jdbcTemplate).update(contains("INSERT INTO form_definition_version"), any(Object[].class));
    }

    @Test
    void shouldRequireConfirmedOperatorReasonImpactScopeAndRollbackPlan() {
        FormDefinition definition = definition("DRAFT", 0);
        when(formDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        FormDefinitionOperationDTO missingConfirmed = operation(11L);
        missingConfirmed.setConfirmed(false);
        assertTrue(assertThrows(BusinessException.class,
                () -> formDefinitionService.publish("ASSET_FORM", missingConfirmed)).getMessage().contains("二次确认"));

        FormDefinitionOperationDTO missingOperator = operation(null);
        assertTrue(assertThrows(BusinessException.class,
                () -> formDefinitionService.publish("ASSET_FORM", missingOperator)).getMessage().contains("操作人"));

        FormDefinitionOperationDTO missingReason = operation(11L);
        missingReason.setReason(" ");
        assertTrue(assertThrows(BusinessException.class,
                () -> formDefinitionService.publish("ASSET_FORM", missingReason)).getMessage().contains("审计原因"));

        FormDefinitionOperationDTO missingImpact = operation(11L);
        missingImpact.setImpactScope(null);
        assertTrue(assertThrows(BusinessException.class,
                () -> formDefinitionService.publish("ASSET_FORM", missingImpact)).getMessage().contains("影响范围"));

        FormDefinitionOperationDTO missingRollbackPlan = operation(11L);
        missingRollbackPlan.setRollbackPlan(null);
        assertTrue(assertThrows(BusinessException.class,
                () -> formDefinitionService.publish("ASSET_FORM", missingRollbackPlan)).getMessage().contains("回滚预案"));
    }

    @Test
    void shouldProvidePreviewAndEmptyReferenceAnalysisFromRealService() {
        FormDefinition definition = definition("PUBLISHED", 1);
        when(formDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        FormDefinitionPreviewDTO preview = formDefinitionService.preview("ASSET_FORM");
        Map<String, Object> references = formDefinitionService.references("ASSET_FORM");

        assertEquals("ASSET_FORM", preview.getFormKey());
        assertEquals(2, preview.getFieldCount());
        assertEquals(1, preview.getSensitiveFieldCount());
        assertEquals(0, references.get("referenceCount"));
        assertEquals(List.of(), references.get("references"));
    }

    private FormDefinitionSaveDTO saveDto(Map<String, Object> schema, Long operatorId) {
        FormDefinitionSaveDTO dto = new FormDefinitionSaveDTO();
        dto.setName("资产表单");
        dto.setDescription("资产流程表单");
        dto.setSchema(schema);
        dto.setOperatorId(operatorId);
        return dto;
    }

    private Map<String, Object> validDangerousSchema() {
        return Map.of(
                "source", "<script>alert(1)</script>",
                "sections", List.of(Map.of(
                        "sectionKey", "basic",
                        "label", "基础信息",
                        "html", "<script>alert(1)</script>",
                        "fields", List.of(
                                Map.of("fieldKey", "assetNo", "label", "资产编号", "type", "text", "onClick", "steal()"),
                                Map.of("fieldKey", "ownerPhone", "label", "联系方式", "type", "text", "sensitive", true, "defaultValue", "13800138000")
                        )
                ))
        );
    }

    private FormDefinition definition(String status, Integer version) {
        FormDefinition definition = new FormDefinition();
        definition.setId(1L);
        definition.setTenantId("T001");
        definition.setFormKey("ASSET_FORM");
        definition.setName("资产表单");
        definition.setDescription("资产流程表单");
        definition.setSchemaJson(validSchemaJson());
        definition.setStatus(status);
        definition.setVersion(version);
        return definition;
    }

    private String validSchemaJson() {
        return "{\"sections\":[{\"sectionKey\":\"basic\",\"label\":\"基础信息\",\"fields\":[{\"fieldKey\":\"assetNo\",\"label\":\"资产编号\",\"type\":\"text\"},{\"fieldKey\":\"ownerPhone\",\"label\":\"联系方式\",\"type\":\"text\",\"sensitive\":true,\"defaultValue\":\"******\"}]}]}";
    }

    private FormDefinitionOperationDTO operation(Long operatorId) {
        FormDefinitionOperationDTO operation = new FormDefinitionOperationDTO();
        operation.setOperatorId(operatorId);
        operation.setConfirmed(true);
        operation.setReason("发布稳定版本");
        operation.setImpactScope("仅影响后续实例");
        operation.setRollbackPlan("恢复上一版本");
        return operation;
    }

    private FormDefinitionVersion version(Integer version, String schemaJson) {
        FormDefinitionVersion snapshot = new FormDefinitionVersion();
        snapshot.setId(99L);
        snapshot.setTenantId("T001");
        snapshot.setDefinitionId(1L);
        snapshot.setFormKey("ASSET_FORM");
        snapshot.setVersion(version);
        snapshot.setActionType("PUBLISH");
        snapshot.setStatus("PUBLISHED");
        snapshot.setName("资产表单");
        snapshot.setDescription("资产流程表单");
        snapshot.setSchemaJson(schemaJson);
        snapshot.setAuditReason("发布稳定版本");
        snapshot.setImpactScope("仅影响后续实例");
        snapshot.setRollbackPlan("恢复上一版本");
        snapshot.setOperatorId(11L);
        return snapshot;
    }
}
