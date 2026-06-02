package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.MailLog;
import com.ams.mapper.MailLogMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 邮件发送日志服务
 *
 * <p>提供邮件发送日志的写入、分页查询、按业务类型追踪、
 * 以及失败重试能力。</p>
 */
@Service
@RequiredArgsConstructor
public class MailLogService {

    private final ApplicationContext applicationContext;
    private final MailLogMapper mailLogMapper;

    /**
     * 分页查询邮件日志
     */
    public Page<MailLog> queryPage(Integer page, Integer pageSize, String templateCode,
                                    String sendStatus, String bizType, Long bizId) {
        String tenantId = TenantContext.requireTenantId();
        Page<MailLog> pageParam = new Page<>(page == null ? 1 : page, pageSize == null ? 10 : pageSize);

        LambdaQueryWrapper<MailLog> wrapper = new LambdaQueryWrapper<MailLog>()
                .eq(MailLog::getTenantId, tenantId);

        if (templateCode != null && !templateCode.isBlank()) {
            wrapper.eq(MailLog::getTemplateCode, templateCode);
        }
        if (sendStatus != null && !sendStatus.isBlank()) {
            wrapper.eq(MailLog::getSendStatus, sendStatus);
        }
        if (bizType != null && !bizType.isBlank()) {
            wrapper.eq(MailLog::getBizType, bizType);
        }
        if (bizId != null) {
            wrapper.eq(MailLog::getBizId, bizId);
        }
        wrapper.orderByDesc(MailLog::getCreateTime);

        return mailLogMapper.selectPage(pageParam, wrapper);
    }

    /**
     * 获取日志详情
     */
    public MailLog getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        MailLog log = mailLogMapper.selectOne(new LambdaQueryWrapper<MailLog>()
                .eq(MailLog::getId, id)
                .eq(MailLog::getTenantId, tenantId));
        if (log == null) {
            throw new RuntimeException("邮件日志不存在");
        }
        return log;
    }

    /**
     * 创建邮件发送日志
     */
    @Transactional(rollbackFor = Exception.class)
    public MailLog create(MailLog mailLog) {
        String tenantId = TenantContext.requireTenantId();
        mailLog.setTenantId(tenantId);
        if (mailLog.getSendStatus() == null) {
            mailLog.setSendStatus("PENDING");
        }
        if (mailLog.getRetryCount() == null) {
            mailLog.setRetryCount(0);
        }
        if (mailLog.getMaxRetry() == null) {
            mailLog.setMaxRetry(3);
        }
        mailLogMapper.insert(mailLog);
        return mailLog;
    }

    /**
     * 更新发送状态
     */
    @Transactional(rollbackFor = Exception.class)
    public void updateStatus(Long id, String status, String errorMessage) {
        MailLog log = mailLogMapper.selectById(id);
        if (log == null) return;
        log.setSendStatus(status);
        log.setErrorMessage(errorMessage);
        if ("SUCCESS".equals(status)) {
            log.setSendTime(LocalDateTime.now());
        }
        mailLogMapper.updateById(log);
    }

    /**
     * 递增重试次数
     */
    @Transactional(rollbackFor = Exception.class)
    public void incrementRetry(Long id) {
        MailLog log = mailLogMapper.selectById(id);
        if (log != null) {
            log.setRetryCount(log.getRetryCount() == null ? 1 : log.getRetryCount() + 1);
            mailLogMapper.updateById(log);
        }
    }

    /**
     * 按业务类型 + 业务ID 查询发送记录
     */
    public List<MailLog> getByBiz(String bizType, Long bizId) {
        String tenantId = TenantContext.requireTenantId();
        return mailLogMapper.selectList(new LambdaQueryWrapper<MailLog>()
                .eq(MailLog::getTenantId, tenantId)
                .eq(MailLog::getBizType, bizType)
                .eq(MailLog::getBizId, bizId)
                .orderByDesc(MailLog::getCreateTime));
    }

    /**
     * 查询待重试的日志（状态为 FAILED，重试次数未达上限）
     */
    public List<MailLog> getPendingRetry(int maxRetryCount) {
        return mailLogMapper.selectList(new LambdaQueryWrapper<MailLog>()
                .eq(MailLog::getSendStatus, "FAILED")
                .lt(MailLog::getRetryCount, maxRetryCount));
    }

    /**
     * 手动重试发送邮件
     *
     * <p>根据日志 ID 查找 MailLog，调用 EmailChannel 重新发送。</p>
     *
     * @param id 邮件日志 ID
     */
    @Transactional(rollbackFor = Exception.class)
    public void retrySend(Long id) {
        MailLog mailLog = getById(id);
        if (mailLog == null) {
            throw new RuntimeException("邮件日志不存在");
        }
        EmailChannel emailChannel = applicationContext.getBean(EmailChannel.class);
        emailChannel.retrySend(mailLog);
    }
}
