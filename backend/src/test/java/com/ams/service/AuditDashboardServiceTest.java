package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AuditDashboardQueryDTO;
import com.ams.dto.AuditDistResp;
import com.ams.dto.AuditLogDTO;
import com.ams.dto.AuditLogDetailDTO;
import com.ams.dto.AuditTrendResp;
import com.ams.dto.OperatorRankingVO;
import com.ams.entity.GeneralAuditEntry;
import com.ams.mapper.AuditLogMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditDashboardServiceTest {

    @Mock
    private AuditLogMapper auditLogMapper;

    private AuditDashboardService service;

    private final LocalDateTime start = LocalDateTime.of(2026, 7, 1, 0, 0);
    private final LocalDateTime end = LocalDateTime.of(2026, 7, 8, 0, 0);

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new AuditDashboardService(auditLogMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listShouldRequireTenantScopeAndReturnOnlyMaskedSummaries() {
        AuditDashboardQueryDTO query = query();
        when(auditLogMapper.countRecords(eq("tenant-a"), eq(start), eq(end), eq("UPDATE"), eq(42L), isNull(), eq("ASSET"), eq("ASSET-001"), eq("credential"))).thenReturn(1L);
        when(auditLogMapper.selectPageRecords(eq("tenant-a"), eq(start), eq(end), eq("UPDATE"), eq(42L), isNull(), eq("ASSET"), eq("ASSET-001"), eq("credential"), eq(20), eq(0)))
                .thenReturn(List.of(entry()));

        AuditLogDTO.PageResult page = service.list(query);

        assertEquals(1, page.getRecords().size());
        AuditLogDTO record = page.getRecords().get(0);
        assertEquals("AS****01", record.getResourceId());
        assertEquals("10.2.*.*", record.getIpAddress());
        assertTrue(record.getBeforeRecordSummary().contains("******"));
        assertFalse(record.getBeforeRecordSummary().contains(rawSecret()));
        assertFalse(record.getAfterRecordSummary().contains(rawSecret()));
        assertFalse(record.getRawPayloadSummary().contains(rawSecret()));
        assertFalse(record.getRequestUri().contains(rawSecret()));
        assertTrue(Boolean.TRUE.equals(record.getTenantScoped()));
        assertTrue(Boolean.TRUE.equals(record.getMasked()));
    }

    @Test
    void detailStatsTrendsDistributionRankingAndMetaShouldRemainTenantScoped() {
        when(auditLogMapper.selectDetail("tenant-a", 7L)).thenReturn(entry());
        when(auditLogMapper.countRecords(eq("tenant-a"), any(), any(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull())).thenReturn(3L);
        when(auditLogMapper.countByDay(eq("tenant-a"), any(), any(), isNull()))
                .thenReturn(List.of(AuditTrendResp.DataPoint.builder().date("2026-07-07").count(2L).build()));
        when(auditLogMapper.countByOperationType(eq("tenant-a"), any(), any()))
                .thenReturn(List.of(AuditDistResp.DistributionItem.builder().actionType("UPDATE").count(2L).build()));
        when(auditLogMapper.countByOperator(eq("tenant-a"), any(), any(), eq(10)))
                .thenReturn(List.of(OperatorRankingVO.builder().operatorId("42").operatorName("管理员").count(2L).build()));
        when(auditLogMapper.listOperationTypes("tenant-a", 100)).thenReturn(List.of("UPDATE"));
        when(auditLogMapper.listResourceTypes("tenant-a", 100)).thenReturn(List.of("ASSET"));
        when(auditLogMapper.listOperators("tenant-a", 100)).thenReturn(List.of("管理员"));

        AuditLogDetailDTO detail = service.detail(7L);
        assertFalse(detail.getRawPayloadSummary().contains(rawSecret()));
        assertEquals(3L, service.stats(new AuditDashboardQueryDTO()).getTotalCount());
        assertEquals("daily", service.trends(new AuditDashboardQueryDTO()).getGranularity());
        assertEquals(100D, service.actionTypeDistribution(new AuditDashboardQueryDTO()).getDistribution().get(0).getPercentage());
        assertEquals(1, service.operatorRanking(new AuditDashboardQueryDTO()).get(0).getRank());
        Map<String, Object> meta = service.meta();
        assertEquals(true, meta.get("tenantScoped"));
        assertTrue(meta.toString().contains("不提供真实导出文件"));
    }

    @Test
    void invalidRangeGranularityAndMissingTenantShouldFailClosedBeforeMapper() {
        AuditDashboardQueryDTO invalidRange = new AuditDashboardQueryDTO();
        invalidRange.setStartTime(end);
        invalidRange.setEndTime(start);
        assertThrows(BusinessException.class, () -> service.trends(invalidRange));

        AuditDashboardQueryDTO invalidGranularity = new AuditDashboardQueryDTO();
        invalidGranularity.setStartTime(start);
        invalidGranularity.setEndTime(end);
        invalidGranularity.setGranularity("weekly");
        assertThrows(BusinessException.class, () -> service.trends(invalidGranularity));

        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> service.list(new AuditDashboardQueryDTO()));
        verifyNoInteractions(auditLogMapper);
    }

    private AuditDashboardQueryDTO query() {
        AuditDashboardQueryDTO query = new AuditDashboardQueryDTO();
        query.setPage(1);
        query.setPageSize(20);
        query.setStartTime(start);
        query.setEndTime(end);
        query.setOperationType("UPDATE");
        query.setOperatorId(42L);
        query.setResourceType("ASSET");
        query.setResourceId("ASSET-001");
        query.setKeyword("credential");
        return query;
    }

    private GeneralAuditEntry entry() {
        GeneralAuditEntry entry = new GeneralAuditEntry();
        entry.setId(7L);
        entry.setTenantId("tenant-a");
        entry.setTraceId("trace-001");
        entry.setTimestamp(LocalDateTime.of(2026, 7, 7, 12, 0));
        entry.setOperationType("UPDATE");
        entry.setOperatorId(42L);
        entry.setOperatorName("管理员");
        entry.setResourceType("ASSET");
        entry.setResourceId("ASSET-001");
        entry.setDescription("更新资产 token=" + rawSecret());
        entry.setHttpMethod("GET");
        entry.setRequestUri("/assets/ASSET-001?token=" + rawSecret());
        entry.setIpAddress("10.2.3.4");
        entry.setUserAgent("Browser credential=" + rawSecret());
        entry.setBeforeRecord("{\"password\":\"" + rawSecret() + "\",\"name\":\"旧资产\"}");
        entry.setAfterRecord("secret=" + rawSecret());
        entry.setRawPayload("{\"nested\":{\"apiKey\":\"" + rawSecret() + "\"}}");
        entry.setErrorMessage("authorization=" + rawSecret());
        entry.setStatus("SUCCESS");
        return entry;
    }

    private String rawSecret() {
        return "raw-audit-secret";
    }
}
