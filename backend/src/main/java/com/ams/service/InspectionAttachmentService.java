package com.ams.service;

import com.ams.entity.SysAttachment;
import com.ams.mapper.SysAttachmentMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 检验附件服务 — 复用 SysAttachment 表，businessType 为 'INSPECTION'。
 * 提供检验照片上传、查询、删除功能。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InspectionAttachmentService {

    private static final String BUSINESS_TYPE_INSPECTION = "INSPECTION";

    private final SysAttachmentMapper sysAttachmentMapper;

    /**
     * 获取指定检验的所有附件列表
     */
    public List<SysAttachment> getAttachments(Long inspectionId) {
        return sysAttachmentMapper.selectList(
                new LambdaQueryWrapper<SysAttachment>()
                        .eq(SysAttachment::getBusinessType, BUSINESS_TYPE_INSPECTION)
                        .eq(SysAttachment::getBusinessId, inspectionId)
                        .orderByDesc(SysAttachment::getCreateTime)
        );
    }

    /**
     * 新增检验附件记录
     */
    @Transactional(rollbackFor = Exception.class)
    public SysAttachment addAttachment(Long inspectionId, String fileName, String filePath,
                                       Long fileSize, String fileType, Long uploadBy) {
        if (fileSize == null || fileSize <= 0) {
            throw new IllegalArgumentException("文件大小无效");
        }

        SysAttachment attachment = new SysAttachment();
        attachment.setBusinessType(BUSINESS_TYPE_INSPECTION);
        attachment.setBusinessId(inspectionId);
        attachment.setFileName(fileName);
        attachment.setFilePath(filePath);
        attachment.setFileSize(fileSize);
        attachment.setFileType(fileType);
        attachment.setUploadBy(uploadBy);
        attachment.setCreateTime(LocalDateTime.now());

        sysAttachmentMapper.insert(attachment);
        log.info("检验附件已创建: inspectionId={}, fileName={}, fileSize={}", inspectionId, fileName, fileSize);
        return attachment;
    }

    /**
     * 删除指定附件记录（软删除）
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteAttachment(Long attachmentId) {
        SysAttachment attachment = sysAttachmentMapper.selectById(attachmentId);
        if (attachment == null) {
            log.warn("附件不存在，忽略删除: attachmentId={}", attachmentId);
            return;
        }
        sysAttachmentMapper.deleteById(attachmentId);
        log.info("检验附件已删除: attachmentId={}, fileName={}", attachmentId, attachment.getFileName());
    }
}