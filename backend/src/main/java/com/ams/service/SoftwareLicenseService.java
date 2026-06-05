package com.ams.service;

import com.ams.entity.LicenseAssignment;
import com.ams.entity.SoftwareLicense;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;
import java.util.Map;

/**
 * 软件许可证服务接口。
 */
public interface SoftwareLicenseService {

    /** 分页查询许可证 */
    Page<SoftwareLicense> getPage(Integer page, Integer pageSize, String keyword, String status);

    /** 获取即将过期的许可证 */
    List<SoftwareLicense> getExpiring(Integer days);

    /** 获取许可证汇总信息 */
    Map<String, Object> getSummary();

    /** 获取许可证详情 */
    SoftwareLicense getById(Long id);

    /** 获取许可证已用席位数 */
    int getUsedSeats(Long licenseId);

    /** 获取许可证的活跃分配记录 */
    List<LicenseAssignment> getActiveAssignments(Long licenseId);

    /** 创建许可证 */
    SoftwareLicense create(SoftwareLicense license);

    /** 更新许可证 */
    SoftwareLicense update(Long id, SoftwareLicense license);

    /** 删除许可证 */
    void delete(Long id);

    /** 分配许可证席位 */
    LicenseAssignment assign(Long licenseId, Long assetId, Long userId, String notes);

    /** 归还许可证席位 */
    void returnLicense(Long assignmentId, String notes);
}
