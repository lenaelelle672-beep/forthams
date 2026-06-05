package com.ams.service;

import com.ams.entity.CycleCountRule;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;

public interface CycleCountRuleService {
    Page<CycleCountRule> list(String classification, Integer pageNum, Integer pageSize);
    CycleCountRule getById(Long id);
    CycleCountRule create(CycleCountRule rule);
    CycleCountRule update(Long id, CycleCountRule rule);
    void delete(Long id);
    List<CycleCountRule> listAll();
}
