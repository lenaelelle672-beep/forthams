package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.dto.BpmMailConfigCreateDTO;
import com.ams.dto.BpmMailConfigUpdateDTO;
import com.ams.dto.BpmMailVariableCreateDTO;
import com.ams.dto.BpmMailVariableUpdateDTO;
import com.ams.entity.BpmMailConfig;
import com.ams.entity.BpmMailVariable;
import com.ams.entity.MailLog;
import com.ams.mapper.BpmMailConfigMapper;
import com.ams.mapper.BpmMailVariableMapper;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class BpmMailConfigService {

    private static final Logger log = LoggerFactory.getLogger(BpmMailConfigService.class);

    private final BpmMailConfigMapper bpmMailConfigMapper;
    private final BpmMailVariableMapper bpmMailVariableMapper;
    private final MailLogService mailLogService;
    private final JavaMailSender mailSender;

    // ==================== Config CRUD ====================

    public List<BpmMailConfig> list(String processType) {
        return bpmMailConfigMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<BpmMailConfig>()
                        .eq(processType != null && !processType.isBlank(),
                                BpmMailConfig::getProcessType, processType)
                        .orderByDesc(BpmMailConfig::getCreatedAt));
    }

    public BpmMailConfig getById(Long id) {
        BpmMailConfig config = bpmMailConfigMapper.selectById(id);
        if (config == null) {
            throw new BusinessException("流程邮件配置不存在");
        }
        return config;
    }

    @Transactional(rollbackFor = Exception.class)
    public BpmMailConfig create(BpmMailConfigCreateDTO dto) {
        BpmMailConfig config = new BpmMailConfig();
        BeanUtil.copyProperties(dto, config);
        if (config.getEnabled() == null) {
            config.setEnabled(1);
        }
        bpmMailConfigMapper.insert(config);
        return config;
    }

    @Transactional(rollbackFor = Exception.class)
    public BpmMailConfig update(Long id, BpmMailConfigUpdateDTO dto) {
        BpmMailConfig config = getById(id);
        BeanUtil.copyProperties(dto, config, "id", "processType");
        bpmMailConfigMapper.updateById(config);
        return config;
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        BpmMailConfig config = getById(id);
        bpmMailConfigMapper.deleteById(id);
    }

    /**
     * 根据流程类型和节点ID获取匹配的配置
     * 优先匹配节点级配置，回退到通用配置
     */
    public BpmMailConfig getByProcessType(String processType, String nodeId) {
        if (nodeId != null && !nodeId.isBlank()) {
            BpmMailConfig nodeConfig = bpmMailConfigMapper.selectOne(
                    new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<BpmMailConfig>()
                            .eq(BpmMailConfig::getProcessType, processType)
                            .eq(BpmMailConfig::getNodeId, nodeId)
                            .eq(BpmMailConfig::getEnabled, 1));
            if (nodeConfig != null) {
                return nodeConfig;
            }
        }
        return bpmMailConfigMapper.selectOne(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<BpmMailConfig>()
                        .eq(BpmMailConfig::getProcessType, processType)
                        .isNull(BpmMailConfig::getNodeId)
                        .eq(BpmMailConfig::getEnabled, 1));
    }

    /**
     * 渲染模板并发送邮件
     *
     * @param processType 流程类型
     * @param nodeId      节点ID（可为空）
     * @param variables   变量映射
     */
    @Transactional(rollbackFor = Exception.class)
    public void renderAndSend(String processType, String nodeId, Map<String, Object> variables) {
        BpmMailConfig config = getByProcessType(processType, nodeId);
        if (config == null) {
            log.warn("No mail config found for processType={}, nodeId={}", processType, nodeId);
            return;
        }

        String subject = renderTemplate(config.getSubjectTemplate(), variables);
        String content = renderTemplate(config.getContentTemplate(), variables);
        String to = renderTemplate(config.getToRecipients(), variables);
        String cc = renderTemplate(config.getCcRecipients(), variables);

        if (to == null || to.isBlank()) {
            log.warn("No recipients for mail config id={}", config.getId());
            return;
        }

        MailLog mailLog = new MailLog();
        mailLog.setTemplateCode(processType + "_" + (nodeId != null ? nodeId : "default"));
        mailLog.setMailTo(to);
        mailLog.setMailCc(cc);
        mailLog.setSubject(subject);
        mailLog.setContent(content);
        mailLog.setBizType(processType);
        mailLog.setSendStatus("PENDING");
        mailLog = mailLogService.create(mailLog);

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setTo(to.trim().split(",\\s*"));
            if (cc != null && !cc.isBlank()) {
                helper.setCc(cc.trim().split(",\\s*"));
            }
            helper.setSubject(subject);
            helper.setText(content, true);
            mailSender.send(mimeMessage);

            mailLogService.updateStatus(mailLog.getId(), "SUCCESS", null);
            log.info("BPM mail sent: processType={}, to={}", processType, to);
        } catch (Exception e) {
            log.error("BPM mail failed: processType={}, error={}", processType, e.getMessage());
            mailLogService.updateStatus(mailLog.getId(), "FAILED", e.getMessage());
        }
    }

    // ==================== Variable CRUD ====================

    public List<BpmMailVariable> listVariables() {
        return bpmMailVariableMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<BpmMailVariable>()
                        .orderByDesc(BpmMailVariable::getCreatedAt));
    }

    @Transactional(rollbackFor = Exception.class)
    public BpmMailVariable createVariable(BpmMailVariableCreateDTO dto) {
        Long count = bpmMailVariableMapper.selectCount(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<BpmMailVariable>()
                        .eq(BpmMailVariable::getVarKey, dto.getVarKey()));
        if (count > 0) {
            throw new BusinessException("变量KEY已存在: " + dto.getVarKey());
        }
        BpmMailVariable variable = new BpmMailVariable();
        BeanUtil.copyProperties(dto, variable);
        bpmMailVariableMapper.insert(variable);
        return variable;
    }

    @Transactional(rollbackFor = Exception.class)
    public BpmMailVariable updateVariable(Long id, BpmMailVariableUpdateDTO dto) {
        BpmMailVariable variable = bpmMailVariableMapper.selectById(id);
        if (variable == null) {
            throw new BusinessException("变量不存在");
        }
        BeanUtil.copyProperties(dto, variable, "id", "varKey");
        bpmMailVariableMapper.updateById(variable);
        return variable;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteVariable(Long id) {
        BpmMailVariable variable = bpmMailVariableMapper.selectById(id);
        if (variable == null) {
            throw new BusinessException("变量不存在");
        }
        bpmMailVariableMapper.deleteById(id);
    }

    // ==================== Template Rendering ====================

    /**
     * 渲染模板 — 将 ${varName} 替换为实际值
     */
    public String renderTemplate(String template, Map<String, Object> variables) {
        if (template == null) return "";
        if (variables == null || variables.isEmpty()) return template;
        String result = template;
        for (Map.Entry<String, Object> entry : variables.entrySet()) {
            String placeholder = "${" + entry.getKey() + "}";
            String value = entry.getValue() != null ? entry.getValue().toString() : "";
            result = result.replace(placeholder, value);
        }
        return result;
    }
}
