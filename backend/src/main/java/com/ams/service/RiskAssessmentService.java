package com.ams.service;

import com.ams.entity.RiskAssessment;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;
import java.util.Map;

public interface RiskAssessmentService {
    Page<RiskAssessment> list(String keyword, String riskLevel, Long assetId,
                              Integer pageNum, Integer pageSize);
    Page<RiskAssessment> listWithSort(String keyword, String riskLevel, Long assetId,
                                     String sortBy, String sortOrder,
                                     Integer pageNum, Integer pageSize);
    RiskAssessment getById(Long id);
    RiskAssessment create(RiskAssessment assessment);
    RiskAssessment update(Long id, RiskAssessment assessment);
    void delete(Long id);
    List<Map<String, Object>> getHeatmapData();
    List<Map<String, Object>> getRiskLevelTrend(String startDate, String endDate, String period);
}
