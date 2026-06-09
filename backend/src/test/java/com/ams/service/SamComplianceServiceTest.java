package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.SamComplianceDetail;
import com.ams.entity.SamComplianceScan;
import com.ams.entity.SoftwareLicense;
import com.ams.mapper.LicenseAssignmentMapper;
import com.ams.mapper.SamComplianceDetailMapper;
import com.ams.mapper.SamComplianceScanMapper;
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

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SamComplianceServiceTest {

    @Mock
    private SoftwareLicenseMapper licenseMapper;

    @Mock
    private LicenseAssignmentMapper assignmentMapper;

    @Mock
    private SamComplianceScanMapper scanMapper;

    @Mock
    private SamComplianceDetailMapper detailMapper;

    private SamComplianceService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "");
        TableInfoHelper.initTableInfo(assistant, SoftwareLicense.class);
        TableInfoHelper.initTableInfo(assistant, SamComplianceScan.class);
        TableInfoHelper.initTableInfo(assistant, SamComplianceDetail.class);
        service = new SamComplianceService(licenseMapper, assignmentMapper, scanMapper, detailMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void runScanShouldBindScanAndDetailsToCurrentTenant() {
        SoftwareLicense license = new SoftwareLicense();
        license.setId(5L);
        license.setTenantId("dept:1");
        license.setLicenseName("Office");
        license.setLicenseType("VOLUME");
        license.setTotalSeats(10);

        when(licenseMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(license));
        when(assignmentMapper.countActiveByLicense("dept:1", 5L)).thenReturn(3);

        SamComplianceScan result = service.runScan();

        ArgumentCaptor<SamComplianceScan> scanCaptor = ArgumentCaptor.forClass(SamComplianceScan.class);
        verify(scanMapper).insert(scanCaptor.capture());
        assertThat(scanCaptor.getValue().getTenantId()).isEqualTo("dept:1");
        assertThat(result.getTenantId()).isEqualTo("dept:1");
        assertThat(result.getComplianceRate()).isEqualByComparingTo(BigDecimal.valueOf(100));

        ArgumentCaptor<SamComplianceDetail> detailCaptor = ArgumentCaptor.forClass(SamComplianceDetail.class);
        verify(detailMapper).insert(detailCaptor.capture());
        assertThat(detailCaptor.getValue().getTenantId()).isEqualTo("dept:1");
        verify(assignmentMapper).countActiveByLicense("dept:1", 5L);
    }

    @Test
    void getLatestScanShouldReadDetailsWithinCurrentTenant() {
        SamComplianceScan scan = new SamComplianceScan();
        scan.setId(11L);
        scan.setTenantId("dept:1");
        when(scanMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(scan);
        when(detailMapper.findByScanId("dept:1", 11L)).thenReturn(List.of(new SamComplianceDetail()));

        var result = service.getLatestScan();

        assertThat(result.get("scan")).isSameAs(scan);
        verify(detailMapper).findByScanId("dept:1", 11L);
    }

    @Test
    void runScanShouldRejectMissingTenantContext() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, service::runScan);
    }
}
