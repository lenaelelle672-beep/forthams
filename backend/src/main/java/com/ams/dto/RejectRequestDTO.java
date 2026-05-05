package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 驳回请求数据传输对象。
 *
 * <p>用于工单审批驳回操作时携带的请求体，强制要求录入驳回原因，
 * 以确保审批过程的合规性与可追溯性。</p>
 *
 * <p>业务约束：</p>
 * <ul>
 *   <li>驳回原因（rejectionReason）为必填字段，不可为空或纯空白</li>
 *   <li>驳回原因最小长度为 10 个字符，防止敷衍性驳回</li>
 *   <li>驳回后工单状态将流转至 {@code REJECTED}（终态）</li>
 * </ul>
 */
public class RejectRequestDTO {

    /**
     * 驳回原因。
     *
     * <p>必填字段，长度不得少于 10 个字符。该字段将被持久化至审批记录中，
     * 作为审批过程不可篡改数据的一部分，仅可追加，禁止修改与删除。</p>
     */
    @NotBlank(message = "驳回原因必填，不可为空")
    @Size(min = 10, message = "驳回原因长度不得少于10个字符")
    private String rejectionReason;

    /**
     * 默认构造函数。
     */
    public RejectRequestDTO() {
    }

    /**
     * 全参构造函数。
     *
     * @param rejectionReason 驳回原因，不可为空且长度不少于10个字符
     */
    public RejectRequestDTO(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    /**
     * 获取驳回原因。
     *
     * @return 驳回原因字符串
     */
    public String getRejectionReason() {
        return rejectionReason;
    }

    /**
     * 设置驳回原因。
     *
     * @param rejectionReason 驳回原因，不可为空且长度不少于10个字符
     */
    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }
}