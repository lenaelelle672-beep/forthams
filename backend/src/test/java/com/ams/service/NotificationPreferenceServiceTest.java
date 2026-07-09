package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.NotificationPreferenceDTO;
import com.ams.dto.NotificationPreferenceMetaDTO;
import com.ams.dto.NotificationPreferencePreviewRequestDTO;
import com.ams.dto.NotificationPreferencePreviewRespDTO;
import com.ams.entity.NotificationPreference;
import com.ams.mapper.NotificationPreferenceMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationPreferenceServiceTest {

    @Mock
    private NotificationPreferenceMapper notificationPreferenceMapper;

    private NotificationPreferenceService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new NotificationPreferenceService(notificationPreferenceMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listCategoryAndMetaShouldRemainTenantScopedAndReadOnly() {
        when(notificationPreferenceMapper.selectAllActive("tenant-a")).thenReturn(List.of(preference("system")));
        when(notificationPreferenceMapper.selectByCategoryAndTenant("tenant-a", "system")).thenReturn(preference("system"));
        when(notificationPreferenceMapper.listCategories("tenant-a", 100)).thenReturn(List.of("system"));

        List<NotificationPreferenceDTO> list = service.list();
        assertEquals("tenant-a", list.get(0).getTenantId());
        assertTrue(list.stream().anyMatch(item -> "system".equals(item.getCategory()) && Boolean.FALSE.equals(item.getMissingPreference())));
        assertTrue(list.stream().anyMatch(item -> "retirement".equals(item.getCategory()) && Boolean.TRUE.equals(item.getMissingPreference())));

        NotificationPreferenceDTO detail = service.getByCategory("system");
        assertEquals("系统", detail.getCategoryLabel());
        assertEquals(true, detail.getTenantScoped());

        NotificationPreferenceMetaDTO meta = service.meta();
        assertEquals(true, meta.getTenantScoped());
        assertEquals(false, meta.getRuntimeEffect());
        assertTrue(meta.getNonGoals().toString().contains("不发送通知"));

        verify(notificationPreferenceMapper).selectAllActive("tenant-a");
        verify(notificationPreferenceMapper).selectByCategoryAndTenant("tenant-a", "system");
        verify(notificationPreferenceMapper).listCategories("tenant-a", 100);
    }

    @Test
    void categoryRouteShouldRejectReservedNumericSlashLikeAndUnknownCategories() {
        assertThrows(BusinessException.class, () -> service.getByCategory("meta"));
        assertThrows(BusinessException.class, () -> service.getByCategory("123"));
        assertThrows(BusinessException.class, () -> service.getByCategory("system/7"));

        when(notificationPreferenceMapper.listCategories("tenant-a", 100)).thenReturn(List.of("system"));
        assertThrows(BusinessException.class, () -> service.getByCategory("unknown"));
    }

    @Test
    void previewShouldBeTenantScopedNoPersistenceNoSendAndRuntimeEffectFalse() {
        NotificationPreference preference = preference("system");
        preference.setInApp(1);
        preference.setEmail(1);
        preference.setQuietStart("22:00");
        preference.setQuietEnd("07:30");
        when(notificationPreferenceMapper.selectByCategoryAndTenant("tenant-a", "system")).thenReturn(preference);
        NotificationPreferencePreviewRequestDTO request = NotificationPreferencePreviewRequestDTO.builder()
                .category("system")
                .channelType("EMAIL")
                .sampleTime("22:30")
                .build();
        request.putUnknownInput("userId", 99L);

        NotificationPreferencePreviewRespDTO response = service.preview(request);

        assertEquals(false, response.getWouldReceive());
        assertEquals(true, response.getInAppEnabled());
        assertEquals(true, response.getEmailEnabled());
        assertEquals(true, response.getQuietWindowMatched());
        assertEquals(true, response.getTenantScoped());
        assertEquals(true, response.getNoPersistence());
        assertEquals(false, response.getRuntimeEffect());
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "userId".equals(item.getField())));
        assertTrue(response.getReadonlyBoundary().contains("不发送通知"));
        verify(notificationPreferenceMapper).selectByCategoryAndTenant("tenant-a", "system");
    }

    @Test
    void previewShouldReportMissingPreferenceWithoutWritingAnything() {
        when(notificationPreferenceMapper.selectByCategoryAndTenant("tenant-a", "approval")).thenReturn(null);
        NotificationPreferencePreviewRespDTO response = service.preview(NotificationPreferencePreviewRequestDTO.builder()
                .category("approval")
                .channelType("IN_APP")
                .sampleTime("09:00")
                .build());

        assertEquals(true, response.getWouldReceive());
        assertEquals(List.of("approval"), response.getMissingPreferences());
        assertEquals(true, response.getNoPersistence());
        assertFalse(response.getRuntimeEffect());
    }

    @Test
    void missingTenantShouldFailClosedBeforeMapper() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, () -> service.list());
        assertThrows(AccessDeniedException.class, () -> service.getByCategory("system"));
        assertThrows(AccessDeniedException.class, () -> service.meta());
        assertThrows(AccessDeniedException.class, () -> service.preview(new NotificationPreferencePreviewRequestDTO()));
        verifyNoInteractions(notificationPreferenceMapper);
    }

    private NotificationPreference preference(String category) {
        NotificationPreference preference = new NotificationPreference();
        preference.setId(7L);
        preference.setTenantId("tenant-a");
        preference.setCategory(category);
        preference.setInApp(1);
        preference.setEmail(0);
        preference.setStatus(1);
        return preference;
    }
}
