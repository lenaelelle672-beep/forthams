package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.NotificationRecord;
import com.ams.entity.NotificationTemplate;
import com.ams.mapper.NotificationMapper;
import com.ams.mapper.NotificationTemplateMapper;
import com.ams.mapper.UserRoleMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("通知服务测试")
class NotificationServiceTest {

    @Mock
    private NotificationMapper notificationMapper;
    @Mock
    private EmailService emailService;
    @Mock
    private NotificationTemplateMapper notificationTemplateMapper;
    @Mock
    private UserRoleMapper userRoleMapper;
    @Mock
    private NotificationChannel notificationChannel;

    @InjectMocks
    private NotificationService notificationService;

    @Test
    @DisplayName("创建通知拒绝空目标用户")
    void createRejectsMissingTargetUser() {
        NotificationRecord record = new NotificationRecord();

        assertThatThrownBy(() -> notificationService.create(record))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("通知目标用户无效");
    }

    @Test
    @DisplayName("模板通知拒绝 0L 目标用户")
    void sendByTemplateRejectsZeroTargetUser() {
        assertThatThrownBy(() -> notificationService.sendByTemplate("system", Map.of(), 0L, 1L, "TEST"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("通知目标用户无效");
    }

    @Test
    @DisplayName("模板通知使用真实目标用户并投递渠道")
    void sendByTemplateUsesRealTargetUser() {
        ReflectionTestUtils.setField(notificationService, "notificationChannels", List.of(notificationChannel));
        NotificationTemplate template = new NotificationTemplate();
        template.setTemplateCode("retirement_approved");
        template.setTitleTemplate("标题 ${assetCode}");
        template.setContentTemplate("内容 ${assetCode}");
        template.setCategory("retirement");
        when(notificationTemplateMapper.selectOne(any())).thenReturn(template);

        notificationService.sendByTemplate("retirement_approved", Map.of("assetCode", "A001"), 42L, 9L, "RETIREMENT_APPLICATION");

        ArgumentCaptor<NotificationRecord> captor = ArgumentCaptor.forClass(NotificationRecord.class);
        verify(notificationMapper).insert(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo(42L);
        assertThat(captor.getValue().getTitle()).isEqualTo("标题 A001");
        verify(notificationChannel).send(captor.getValue());
    }

    @Test
    @DisplayName("角色通知仅向角色解析出的真实用户投递")
    void sendByTemplateToRoleUsesResolvedUsers() {
        when(userRoleMapper.selectActiveUserIdsByRole(eq("SUPER_ADMIN"))).thenReturn(List.of(42L));

        int sent = notificationService.sendByTemplateToRole("retirement_submitted", "SUPER_ADMIN", Map.of(), 7L, "RETIREMENT_APPLICATION");

        assertThat(sent).isEqualTo(1);
        ArgumentCaptor<NotificationRecord> captor = ArgumentCaptor.forClass(NotificationRecord.class);
        verify(notificationMapper).insert(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo(42L);
    }
}
