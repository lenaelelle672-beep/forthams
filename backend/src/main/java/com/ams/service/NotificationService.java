package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.NotificationRecord;
import com.ams.mapper.NotificationMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Objects;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;

/**
 * 通知中心服务
 *
 * <p>管理用户站内通知的完整生命周期：创建、分页查询、未读计数、
 * 标记已读（单条/全部）、删除。支持按类型和分类过滤，
 * 并提供退休通知域方法，同步创建站内通知并异步发送邮件。</p>
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationMapper notificationMapper;
    private final EmailService emailService;

    @Autowired
    @Lazy
    private List<NotificationChannel> notificationChannels;

    /**
     * 分页查询用户通知列表
     *
     * @param userId   用户 ID
     * @param page     页码（从 1 开始）
     * @param pageSize 每页条数
     * @param category 分类过滤（可为空）
     * @param type     类型过滤（可为空）
     * @return 分页结果
     */
    public Page<NotificationRecord> getPage(Long userId, Integer page, Integer pageSize,
                                             String category, String type) {
        Page<NotificationRecord> pageParam = new Page<>(page, pageSize);
        LambdaQueryWrapper<NotificationRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(NotificationRecord::getUserId, userId);
        if (category != null && !category.isBlank()) {
            wrapper.eq(NotificationRecord::getCategory, category);
        }
        if (type != null && !type.isBlank()) {
            wrapper.eq(NotificationRecord::getType, type);
        }
        wrapper.orderByDesc(NotificationRecord::getCreatedAt);
        return notificationMapper.selectPage(pageParam, wrapper);
    }

    /**
     * 获取用户未读通知数量
     *
     * @param userId 用户 ID
     * @return 未读数量
     */
    public Long getUnreadCount(Long userId) {
        return notificationMapper.selectCount(new LambdaQueryWrapper<NotificationRecord>()
                .eq(NotificationRecord::getUserId, userId)
                .eq(NotificationRecord::getIsRead, 0));
    }

    /**
     * 标记单条通知为已读
     *
     * @param id     通知 ID
     * @param userId 用户 ID（用于权限校验）
     */
    @Transactional(rollbackFor = Exception.class)
    public void markAsRead(Long id, Long userId) {
        NotificationRecord record = notificationMapper.selectOne(new LambdaQueryWrapper<NotificationRecord>()
                .eq(NotificationRecord::getId, id)
                .eq(NotificationRecord::getUserId, userId));
        if (record == null) {
            throw new BusinessException("通知不存在");
        }
        if (record.getIsRead() != null && record.getIsRead() == 1) {
            return;
        }
        record.setIsRead(1);
        record.setReadAt(LocalDateTime.now());
        notificationMapper.updateById(record);
    }

    /**
     * 标记当前用户所有通知为已读
     *
     * @param userId 用户 ID
     */
    @Transactional(rollbackFor = Exception.class)
    public void markAllAsRead(Long userId) {
        NotificationRecord update = new NotificationRecord();
        update.setIsRead(1);
        update.setReadAt(LocalDateTime.now());
        notificationMapper.update(update, new LambdaUpdateWrapper<NotificationRecord>()
                .eq(NotificationRecord::getUserId, userId)
                .eq(NotificationRecord::getIsRead, 0));
    }

    /**
     * 删除单条通知
     *
     * @param id     通知 ID
     * @param userId 用户 ID（用于权限校验）
     */
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id, Long userId) {
        int deleted = notificationMapper.delete(new LambdaQueryWrapper<NotificationRecord>()
                .eq(NotificationRecord::getId, id)
                .eq(NotificationRecord::getUserId, userId));
        if (deleted == 0) {
            throw new BusinessException("通知不存在");
        }
    }

    /**
     * 创建通知记录
     *
     * @param record 通知实体
     * @return 创建后的通知实体（含生成的 ID）
     */
    @Transactional(rollbackFor = Exception.class)
    public NotificationRecord create(NotificationRecord record) {
        if (record.getCreatedAt() == null) {
            record.setCreatedAt(LocalDateTime.now());
        }
        if (record.getIsRead() == null) {
            record.setIsRead(0);
        }
        notificationMapper.insert(record);
        return record;
    }

    /**
     * 获取用户所有未读通知列表（兼容旧接口）
     *
     * @param userId 用户 ID
     * @return 未读通知列表
     */
    public List<NotificationRecord> getUnreadList(Long userId) {
        return notificationMapper.selectList(new LambdaQueryWrapper<NotificationRecord>()
                .eq(NotificationRecord::getUserId, userId)
                .eq(NotificationRecord::getIsRead, 0)
                .orderByDesc(NotificationRecord::getCreatedAt));
    }

    // ==================== 退休通知域方法 ====================

    /**
     * 发送退休申请提交通知 — 创建站内通知 + 异步邮件通知
     *
     * @param applicationId  退休申请 ID
     * @param applicantName  申请人名称
     * @param assetCode      资产编码
     */
    public void sendRetirementSubmitted(Long applicationId, String applicantName, String assetCode) {
        Objects.requireNonNull(applicationId, "applicationId must not be null");
        Objects.requireNonNull(applicantName, "applicantName must not be null");
        Objects.requireNonNull(assetCode, "assetCode must not be null");

        NotificationRecord record = new NotificationRecord();
        record.setUserId(0L);
        record.setTitle("新的报废申请");
        record.setContent("申请人 " + applicantName + " 提交了资产 " + assetCode + " 的报废申请");
        record.setType("retirement_submitted");
        record.setCategory("retirement");
        record.setRefId(applicationId);
        record.setRefType("RETIREMENT_APPLICATION");
        if (notificationChannels != null) {
            for (NotificationChannel channel : notificationChannels) {
                channel.send(record);
            }
        }
    }

    /**
     * 发送退休申请审批通过通知 — 创建站内通知 + 异步邮件通知
     *
     * @param applicationId  退休申请 ID
     * @param applicantName  申请人名称
     * @param assetCode      资产编码
     */
    public void sendRetirementApproved(Long applicationId, String applicantName, String assetCode) {
        Objects.requireNonNull(applicationId, "applicationId must not be null");
        Objects.requireNonNull(applicantName, "applicantName must not be null");
        Objects.requireNonNull(assetCode, "assetCode must not be null");

        NotificationRecord record = new NotificationRecord();
        record.setUserId(0L);
        record.setTitle("报废申请已通过");
        record.setContent("您的资产 " + assetCode + " 的报废申请已审批通过");
        record.setType("retirement_approved");
        record.setCategory("retirement");
        record.setRefId(applicationId);
        record.setRefType("RETIREMENT_APPLICATION");
        if (notificationChannels != null) {
            for (NotificationChannel channel : notificationChannels) {
                channel.send(record);
            }
        }
    }

    /**
     * 发送退休申请审批拒绝通知 — 创建站内通知 + 异步邮件通知
     *
     * @param applicationId  退休申请 ID
     * @param applicantName  申请人名称
     * @param assetCode      资产编码
     * @param rejectReason   驳回原因
     */
    public void sendRetirementRejected(Long applicationId, String applicantName, String assetCode, String rejectReason) {
        Objects.requireNonNull(applicationId, "applicationId must not be null");
        Objects.requireNonNull(applicantName, "applicantName must not be null");
        Objects.requireNonNull(assetCode, "assetCode must not be null");

        String reason = (rejectReason == null || rejectReason.isBlank()) ? "未提供原因" : rejectReason;
        NotificationRecord record = new NotificationRecord();
        record.setUserId(0L);
        record.setTitle("报废申请已驳回");
        record.setContent("您的资产 " + assetCode + " 的报废申请被驳回，原因：" + reason);
        record.setType("retirement_rejected");
        record.setCategory("retirement");
        record.setRefId(applicationId);
        record.setRefType("RETIREMENT_APPLICATION");
        if (notificationChannels != null) {
            for (NotificationChannel channel : notificationChannels) {
                channel.send(record);
            }
        }
    }

    /**
     * 发送 72h 超时催办通知 — 创建站内通知 + 异步邮件通知
     *
     * @param applicationId  退休申请 ID
     * @param assetCode      资产编码
     */
    public void sendApprovalReminder(Long applicationId, String assetCode) {
        Objects.requireNonNull(applicationId, "applicationId must not be null");
        Objects.requireNonNull(assetCode, "assetCode must not be null");

        NotificationRecord record = new NotificationRecord();
        record.setUserId(0L);
        record.setTitle("报废申请审批催办");
        record.setContent("资产 " + assetCode + " 的报废申请已等待审批超过72小时，请及时处理");
        record.setType("retirement_reminder");
        record.setCategory("retirement");
        record.setRefId(applicationId);
        record.setRefType("RETIREMENT_APPLICATION");
        if (notificationChannels != null) {
            for (NotificationChannel channel : notificationChannels) {
                channel.send(record);
            }
        }
    }

    // -- end retirement notification methods

}
