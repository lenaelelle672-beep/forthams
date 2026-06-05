package com.ams.service;

import com.ams.entity.SavedReport;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;
import java.util.Map;

public interface DynamicReportService {
    Page<SavedReport> list(String reportType, String keyword, Integer pageNum, Integer pageSize);
    SavedReport getById(Long id);
    SavedReport create(SavedReport report);
    SavedReport update(Long id, SavedReport report);
    void delete(Long id);

    /**
     * 执行已保存的报表，根据 configJson 动态查询并返回数据
     */
    List<Map<String, Object>> executeReport(Long savedReportId);
}
