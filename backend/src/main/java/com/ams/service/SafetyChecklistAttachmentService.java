package com.ams.service;

import com.ams.entity.SysAttachment;

import java.util.List;

/**
 * 安全检查表附件服务 — 复用 SysAttachment 表，businessType 为 'SAFETY_CHECKLIST_RESULT'。
 * 提供安全检查表照片上传、查询、删除功能。
 */
public interface SafetyChecklistAttachmentService {

    /**
     * 获取指定检查项结果的所有附件列表
     *
     * @param resultId 检查项结果 ID
     * @return 附件列表
     */
    List<SysAttachment> getAttachments(Long resultId);

    /**
     * 新增照片附件记录
     *
     * @param resultId  检查项结果 ID
     * @param fileName  文件名
     * @param filePath  文件存储路径
     * @param fileSize  文件大小（字节）
     * @param fileType  文件类型（如 image/jpeg）
     * @param uploadBy  上传人 ID
     * @return 新增的附件记录
     * @throws IllegalArgumentException 如果参数无效
     */
    SysAttachment addAttachment(Long resultId, String fileName, String filePath,
                               Long fileSize, String fileType, Long uploadBy);

    /**
     * 删除指定附件记录（软删除）
     *
     * @param attachmentId 附件 ID
     * @throws IllegalArgumentException 如果附件不存在
     */
    void deleteAttachment(Long attachmentId);
}