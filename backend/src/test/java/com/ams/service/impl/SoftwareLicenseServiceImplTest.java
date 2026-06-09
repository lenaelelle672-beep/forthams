package com.ams.service.impl;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.LicenseAssignment;
import com.ams.entity.SoftwareLicense;
import com.ams.mapper.LicenseAssignmentMapper;
import com.ams.mapper.SoftwareLicenseMapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareLicenseServiceImplTest {

    @Mock
    private SoftwareLicenseMapper softwareLicenseMapper;

    @Mock
    private LicenseAssignmentMapper licenseAssignmentMapper;

    private SoftwareLicenseServiceImpl service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "");
        TableInfoHelper.initTableInfo(assistant, SoftwareLicense.class);
        TableInfoHelper.initTableInfo(assistant, LicenseAssignment.class);
        service = new SoftwareLicenseServiceImpl(softwareLicenseMapper, licenseAssignmentMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void createShouldBindCurrentTenantBeforeInsert() {
        SoftwareLicense license = new SoftwareLicense();
        license.setLicenseName("IDE");

        service.create(license);

        ArgumentCaptor<SoftwareLicense> captor = ArgumentCaptor.forClass(SoftwareLicense.class);
        verify(softwareLicenseMapper).insert(captor.capture());
        assertThat(captor.getValue().getTenantId()).isEqualTo("dept:1");
    }

    @Test
    void getExpiringShouldQueryCurrentTenantOnly() {
        SoftwareLicense license = new SoftwareLicense();
        when(softwareLicenseMapper.findExpiring(eq("dept:1"), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(license));

        List<SoftwareLicense> result = service.getExpiring(30);

        assertThat(result).containsExactly(license);
        verify(softwareLicenseMapper).findExpiring(eq("dept:1"), any(LocalDate.class), any(LocalDate.class));
    }

    @Test
    void assignShouldValidateTenantScopedLicenseAndBindAssignmentTenant() {
        SoftwareLicense license = new SoftwareLicense();
        license.setId(8L);
        license.setTenantId("dept:1");
        when(softwareLicenseMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(license);

        LicenseAssignment result = service.assign(8L, 100L, 200L, "dev workstation");

        ArgumentCaptor<LicenseAssignment> captor = ArgumentCaptor.forClass(LicenseAssignment.class);
        verify(licenseAssignmentMapper).insert(captor.capture());
        assertThat(result.getTenantId()).isEqualTo("dept:1");
        assertThat(captor.getValue().getTenantId()).isEqualTo("dept:1");
        assertThat(captor.getValue().getLicenseId()).isEqualTo(8L);
    }

    @Test
    void getByIdShouldRejectMissingTenantRecord() {
        when(softwareLicenseMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        assertThrows(BusinessException.class, () -> service.getById(99L));
    }

    @Test
    void listShouldRejectMissingTenantContext() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, () -> service.getPage(1, 10, null, null));
    }
}
