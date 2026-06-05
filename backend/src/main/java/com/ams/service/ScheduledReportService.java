package com.ams.service;

import com.ams.entity.ScheduledReport;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;

public interface ScheduledReportService {
    Page<ScheduledReport> list(Integer pageNum, Integer pageSize, String status, String keyword);
    ScheduledReport getById(Long id);
    ScheduledReport create(ScheduledReport report);
    ScheduledReport update(Long id, ScheduledReport report);
    void delete(Long id);
    ScheduledReport toggleStatus(Long id);
    /** 扫描并执行到期的定时报表 */
    void scanAndExecute();
}
