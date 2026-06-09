package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.InspectionTemplate;
import com.ams.mapper.InspectionTemplateMapper;
import com.ams.service.impl.InspectionTemplateServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InspectionTemplateServiceImplTest {

    @Mock
    private InspectionTemplateMapper templateMapper;

    @InjectMocks
    private InspectionTemplateServiceImpl templateService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void copyTemplateShouldCreateTenantScopedDuplicate() {
        InspectionTemplate source = sourceTemplate();
        when(templateMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(source);
        when(templateMapper.insert(any(InspectionTemplate.class))).thenReturn(1);

        InspectionTemplate result = templateService.copyTemplate(7L);

        ArgumentCaptor<InspectionTemplate> captor = ArgumentCaptor.forClass(InspectionTemplate.class);
        verify(templateMapper).insert(captor.capture());
        InspectionTemplate inserted = captor.getValue();
        assertEquals("年度安全模板 副本", inserted.getTemplateName());
        assertEquals("ANNUAL", inserted.getType());
        assertEquals(12, inserted.getFrequency());
        assertEquals("[1,2]", inserted.getCategoryIds());
        assertEquals("[\"外观\",\"性能\"]", inserted.getCheckItems());
        assertEquals("ACTIVE", inserted.getStatus());
        assertEquals("tenant-a", inserted.getTenantId());
        assertEquals(99L, inserted.getCreateBy());
        assertNull(inserted.getId());
        assertEquals(inserted, result);
    }

    @Test
    void copyTemplateShouldRejectMissingTemplate() {
        when(templateMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> templateService.copyTemplate(404L));

        assertEquals("检验模板不存在", exception.getMessage());
        verify(templateMapper, never()).insert(any(InspectionTemplate.class));
    }

    private static InspectionTemplate sourceTemplate() {
        InspectionTemplate template = new InspectionTemplate();
        template.setId(7L);
        template.setTemplateName("年度安全模板");
        template.setType("ANNUAL");
        template.setFrequency(12);
        template.setCategoryIds("[1,2]");
        template.setCheckItems("[\"外观\",\"性能\"]");
        template.setStatus("ACTIVE");
        template.setTenantId("tenant-a");
        template.setCreateBy(99L);
        return template;
    }
}
