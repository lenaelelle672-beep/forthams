package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.WorkOrderDTO;
import com.ams.entity.Asset;
import com.ams.entity.Inspection;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.InspectionMapper;
import com.ams.service.impl.InspectionServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InspectionServiceImplTest {

    @Mock
    private InspectionMapper inspectionMapper;

    @Mock
    private AssetService assetService;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private NotificationService notificationService;

    @Mock
    private WorkOrderService workOrderService;

    @Mock
    private TenantService tenantService;

    @InjectMocks
    private InspectionServiceImpl inspectionService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void autoGenerateInspectionsShouldGenerateByCategoryWhenAssetIdsAreEmpty() {
        Asset assetOne = asset(10L, 3L);
        Asset assetTwo = asset(11L, 3L);
        when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(assetOne, assetTwo));
        when(assetService.getAssetById(10L)).thenReturn(assetOne);
        when(assetService.getAssetById(11L)).thenReturn(assetTwo);
        when(inspectionMapper.insert(any(Inspection.class))).thenReturn(1);

        List<Inspection> result = inspectionService.autoGenerateInspections(List.of(), 3L);

        assertEquals(2, result.size());
        ArgumentCaptor<Inspection> captor = ArgumentCaptor.forClass(Inspection.class);
        verify(inspectionMapper, times(2)).insert(captor.capture());
        List<Inspection> inserted = captor.getAllValues();
        assertInspection(inserted.get(0), 10L);
        assertInspection(inserted.get(1), 11L);
    }

    @Test
    void markOverdueInspectionsShouldBindAndClearTenantContext() {
        TenantContext.clear();
        Inspection inspection = new Inspection();
        inspection.setId(20L);
        inspection.setAssetId(10L);
        inspection.setTenantId("dept:1");
        inspection.setInspectionNo("INS-001");
        inspection.setNextInspectionDate(LocalDate.now().minusDays(3));
        Asset asset = asset(10L, 3L);
        asset.setTenantId("dept:1");

        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1", "dept:2"));
        when(inspectionMapper.selectList(any(LambdaQueryWrapper.class))).thenAnswer(invocation -> {
            String tenantId = TenantContext.getTenantId();
            if ("dept:1".equals(tenantId)) {
                return List.of(inspection);
            }
            assertEquals("dept:2", tenantId);
            return List.of();
        });
        when(assetService.getAssetById(10L)).thenAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            return asset;
        });

        inspectionService.markOverdueInspections();

        ArgumentCaptor<Inspection> inspectionCaptor = ArgumentCaptor.forClass(Inspection.class);
        verify(inspectionMapper).updateById(inspectionCaptor.capture());
        assertEquals("OVERDUE", inspectionCaptor.getValue().getResult());
        verify(notificationService).sendByTemplate(
                eq("INS_INSPECTION_OVERDUE"),
                any(Map.class),
                eq(0L),
                eq(20L),
                eq("INSPECTION"));
        ArgumentCaptor<WorkOrderDTO> workOrderCaptor = ArgumentCaptor.forClass(WorkOrderDTO.class);
        verify(workOrderService).createWorkOrder(workOrderCaptor.capture());
        assertEquals("检验逾期整改", workOrderCaptor.getValue().getTitle());
        assertNull(TenantContext.getTenantId());
    }

    private static Asset asset(Long id, Long categoryId) {
        Asset asset = new Asset();
        asset.setId(id);
        asset.setCategoryId(categoryId);
        asset.setTenantId("tenant-a");
        asset.setAssetName("检验资产-" + id);
        return asset;
    }

    private static void assertInspection(Inspection inspection, Long assetId) {
        assertEquals(assetId, inspection.getAssetId());
        assertEquals("tenant-a", inspection.getTenantId());
        assertEquals("PERIODIC", inspection.getInspectionType());
        assertEquals("PENDING", inspection.getResult());
        assertEquals(LocalDate.now(), inspection.getInspectionDate());
        assertEquals(LocalDate.now().plusMonths(12), inspection.getNextInspectionDate());
        assertNotNull(inspection.getInspectionNo());
    }
}
