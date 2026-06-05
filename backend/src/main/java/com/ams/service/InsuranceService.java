package com.ams.service;

import com.ams.entity.Insurance;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface InsuranceService {
    Page<Insurance> listInsurance(String keyword, String insuranceType, String status, LocalDate startDate, LocalDate endDate, Integer pageNum, Integer pageSize);
    Insurance getById(Long id);
    Insurance create(Insurance insurance);
    Insurance update(Long id, Insurance insurance);
    void delete(Long id);
    List<Insurance> getUpcomingExpirations(int days);
    List<Insurance> getExpiringPolicies(int days);
    BigDecimal getTotalPremiumByAssetId(Long assetId);
}