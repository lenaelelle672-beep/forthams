package com.ams.service;

import com.ams.dto.AssetAssignmentCreateDTO;
import com.ams.dto.AssetAssignmentQueryDTO;
import com.ams.dto.AssetAssignmentUpdateDTO;
import com.ams.entity.AssetAssignment;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

/**
 * 资产领用归还服务接口。
 */
public interface AssetAssignmentService {

    /** 分页查询领用单 */
    Page<AssetAssignment> queryPage(AssetAssignmentQueryDTO queryDTO);

    /** 获取领用单详情 */
    AssetAssignment getDetail(Long id);

    /** 创建领用单 */
    AssetAssignment create(AssetAssignmentCreateDTO dto);

    /** 更新领用单 */
    AssetAssignment update(Long id, AssetAssignmentUpdateDTO dto);

    /** 删除领用单 */
    void delete(Long id);

    /** 提交审批 */
    AssetAssignment submit(Long id);

    /** 审批通过 */
    AssetAssignment approve(Long id);

    /** 审批驳回 */
    AssetAssignment reject(Long id, String reason);

    /** 签收（领用出库） */
    AssetAssignment checkout(Long id);

    /** 发起归还申请 */
    AssetAssignment returnRequest(Long id);

    /** 审批归还 */
    AssetAssignment approveReturn(Long id, String returnCondition);

    /** 取消领用单 */
    AssetAssignment cancel(Long id);
}
