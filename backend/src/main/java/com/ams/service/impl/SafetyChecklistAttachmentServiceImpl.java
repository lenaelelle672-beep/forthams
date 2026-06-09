package com.ams.service.impl;

import com.ams.context.TenantContext;
import com.ams.entity.SysAttachment;
import com.ams.mapper.SysAttachmentMapper;
import com.ams.service.SafetyChecklistAttachmentService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 安全检查表附件服务实现 — 复用 SysAttachment 表，businessType 为 'SAFETY_CHECKLIST_RESULT'。
 * 提供照片上传、查询、删除功能，包含文件验证、错误处理和权限控制。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SafetyChecklistAttachmentServiceImpl implements SafetyChecklistAttachmentService {

    private static final String BUSINESS_TYPE_SAFETY_CHECKLIST_RESULT = "SAFETY_CHECKLIST_RESULT";
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    private final SysAttachmentMapper sysAttachmentMapper;

    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;

    @Override
    public List<SysAttachment> getAttachments(Long resultId) {
        if (resultId == null) {
            throw new IllegalArgumentException("检查项结果 ID 不能为空");
        }
        return sysAttachmentMapper.selectList(
                new LambdaQueryWrapper<SysAttachment>()
                        .eq(SysAttachment::getBusinessType, BUSINESS_TYPE_SAFETY_CHECKLIST_RESULT)
                        .eq(SysAttachment::getBusinessId, resultId)
                        .orderByDesc(SysAttachment::getCreateTime)
        );
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysAttachment addAttachment(Long resultId, String fileName, String filePath,
                                      Long fileSize, String fileType, Long uploadBy) {
        // 参数验证
        if (resultId == null) {
            throw new IllegalArgumentException("检查项结果 ID 不能为空");
        }
        if (fileName == null || fileName.isEmpty()) {
            throw new IllegalArgumentException("文件名不能为空");
        }
        if (filePath == null || filePath.isEmpty()) {
            throw new IllegalArgumentException("文件路径不能为空");
        }
        if (fileSize == null || fileSize <= 0) {
            throw new IllegalArgumentException("文件大小无效");
        }
        if (fileSize > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("文件大小不能超过 5MB");
        }
        if (fileType == null || fileType.isEmpty()) {
            throw new IllegalArgumentException("文件类型不能为空");
        }
        if (uploadBy == null) {
            throw new IllegalArgumentException("上传人 ID 不能为空");
        }

        // 验证文件类型（白名单）
        if (!isAllowedFileType(fileType)) {
            throw new IllegalArgumentException("不支持的文件类型，仅允许 jpg、png、jpeg 格式的图片");
        }

        SysAttachment attachment = new SysAttachment();
        attachment.setTenantId(TenantContext.requireTenantId());
        attachment.setBusinessType(BUSINESS_TYPE_SAFETY_CHECKLIST_RESULT);
        attachment.setBusinessId(resultId);
        attachment.setFileName(fileName);
        attachment.setFilePath(filePath);
        attachment.setFileSize(fileSize);
        attachment.setFileType(fileType);
        attachment.setUploadBy(uploadBy);
        attachment.setCreateTime(LocalDateTime.now());

        sysAttachmentMapper.insert(attachment);
        log.info("安全检查表照片已创建: resultId={}, fileName={}, fileSize={}, uploadBy={}",
                resultId, fileName, fileSize, uploadBy);
        return attachment;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteAttachment(Long attachmentId) {
        if (attachmentId == null) {
            throw new IllegalArgumentException("附件 ID 不能为空");
        }

        SysAttachment attachment = sysAttachmentMapper.selectById(attachmentId);
        if (attachment == null) {
            throw new IllegalArgumentException("附件不存在: attachmentId=" + attachmentId);
        }

        // 验证附件类型是否为安全检查表结果附件
        if (!BUSINESS_TYPE_SAFETY_CHECKLIST_RESULT.equals(attachment.getBusinessType())) {
            throw new IllegalArgumentException("附件类型不匹配，无法删除安全检查表照片");
        }

        sysAttachmentMapper.deleteById(attachmentId);
        deletePhysicalFile(attachment.getFilePath());
        log.info("安全检查表照片已删除: attachmentId={}, fileName={}", attachmentId, attachment.getFileName());
    }

    /**
     * 检查文件类型是否在白名单中
     *
     * @param fileType 文件类型（如 image/jpeg）
     * @return 是否允许
     */
    private boolean isAllowedFileType(String fileType) {
        return fileType.startsWith("image/jpeg") ||
                fileType.startsWith("image/png") ||
                fileType.startsWith("image/jpg");
    }

    private void deletePhysicalFile(String filePath) {
        if (filePath == null || filePath.isBlank()) {
            return;
        }

        String filename = extractFilename(filePath);
        if (filename == null || filename.isBlank()) {
            return;
        }

        try {
            Path uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
            Path targetPath = uploadRoot.resolve(filename).normalize();
            if (!targetPath.startsWith(uploadRoot)) {
                log.warn("安全检查表照片物理文件路径不合法，跳过删除: filePath={}", filePath);
                return;
            }
            if (Files.deleteIfExists(targetPath)) {
                log.info("安全检查表照片物理文件已删除: filePath={}", targetPath);
            }
        } catch (IOException e) {
            log.warn("安全检查表照片物理文件删除失败: filePath={}, error={}", filePath, e.getMessage());
        }
    }

    private String extractFilename(String filePath) {
        String normalized = filePath.replace('\\', '/');
        int queryIndex = normalized.indexOf('?');
        if (queryIndex >= 0) {
            normalized = normalized.substring(0, queryIndex);
        }
        if (normalized.startsWith("/api/file/")) {
            normalized = normalized.substring("/api/file/".length());
        }
        return Paths.get(normalized).getFileName().toString();
    }
}
