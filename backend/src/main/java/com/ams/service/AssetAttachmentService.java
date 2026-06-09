package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.SysAttachment;
import com.ams.mapper.SysAttachmentMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 资产附件服务 — 复用 SysAttachment 表，businessType 固定为 'ASSET'。
 *
 * <p>提供按资产 ID 查询、上传、删除附件的能力。
 * 所有查询按 businessType='ASSET' + businessId=assetId 过滤。</p>
 */
@Service
@RequiredArgsConstructor
public class AssetAttachmentService {

    private static final Logger log = LoggerFactory.getLogger(AssetAttachmentService.class);
    private static final String BUSINESS_TYPE_ASSET = "ASSET";

    private final SysAttachmentMapper sysAttachmentMapper;

    /**
     * 获取指定资产的所有附件列表，按 createTime 倒序排列。
     */
    public List<SysAttachment> getAttachments(Long assetId) {
        return sysAttachmentMapper.selectList(
                new LambdaQueryWrapper<SysAttachment>()
                        .eq(SysAttachment::getBusinessType, BUSINESS_TYPE_ASSET)
                        .eq(SysAttachment::getBusinessId, assetId)
                        .orderByDesc(SysAttachment::getCreateTime)
        );
    }

    /**
     * 新增附件记录。
     *
     * @param assetId  资产 ID
     * @param fileName 文件名
     * @param filePath 文件存储路径
     * @param fileSize 文件大小（字节），必须 > 0
     * @param fileType 文件 MIME 类型
     * @param uploadBy 上传人 ID
     * @return 创建的附件记录
     * @throws IllegalArgumentException 如果文件大小无效
     */
    @Transactional(rollbackFor = Exception.class)
    public SysAttachment addAttachment(Long assetId, String fileName, String filePath,
                                       Long fileSize, String fileType, Long uploadBy) {
        // 文件大小校验
        if (fileSize == null || fileSize <= 0) {
            throw new IllegalArgumentException("文件大小无效");
        }

        SysAttachment attachment = new SysAttachment();
        attachment.setTenantId(TenantContext.requireTenantId());
        attachment.setBusinessType(BUSINESS_TYPE_ASSET);
        attachment.setBusinessId(assetId);
        attachment.setFileName(fileName);
        attachment.setFilePath(filePath);
        attachment.setFileSize(fileSize);
        attachment.setFileType(fileType);
        attachment.setUploadBy(uploadBy);
        attachment.setCreateTime(LocalDateTime.now());

        sysAttachmentMapper.insert(attachment);
        log.info("资产附件已创建: assetId={}, fileName={}, fileSize={}", assetId, fileName, fileSize);
        return attachment;
    }

    /**
     * 删除指定附件记录（软删除）。
     *
     * @param attachmentId 附件 ID
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteAttachment(Long attachmentId) {
        SysAttachment attachment = sysAttachmentMapper.selectById(attachmentId);
        if (attachment == null) {
            log.warn("附件不存在，忽略删除: attachmentId={}", attachmentId);
            return;
        }
        sysAttachmentMapper.deleteById(attachmentId);
        log.info("资产附件已删除: attachmentId={}, fileName={}", attachmentId, attachment.getFileName());
    }

    /**
     * 删除指定资产下的全部附件记录（软删除）。
     *
     * @param assetId 资产 ID
     * @throws IllegalArgumentException 如果 assetId 为空
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteByAssetId(Long assetId) {
        if (assetId == null) {
            throw new IllegalArgumentException("资产ID不能为空");
        }

        int deleted = sysAttachmentMapper.delete(
                new LambdaQueryWrapper<SysAttachment>()
                        .eq(SysAttachment::getBusinessType, BUSINESS_TYPE_ASSET)
                        .eq(SysAttachment::getBusinessId, assetId)
        );
        log.info("资产附件已批量清理: assetId={}, count={}", assetId, deleted);
    }
}
