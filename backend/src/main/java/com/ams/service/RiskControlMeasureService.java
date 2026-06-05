package com.ams.service;

import com.ams.entity.RiskControlMeasure;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;

public interface RiskControlMeasureService {
    Page<RiskControlMeasure> listByRiskAssessment(Long riskAssessmentId, Integer pageNum, Integer pageSize);
    RiskControlMeasure getById(Long id);
    RiskControlMeasure create(RiskControlMeasure measure);
    RiskControlMeasure update(Long id, RiskControlMeasure measure);
    void delete(Long id);
    void deleteByRiskAssessmentId(Long riskAssessmentId);
}