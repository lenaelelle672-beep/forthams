package com.ams.service;

import com.ams.entity.InsuranceClaim;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;

public interface InsuranceClaimService {
    Page<InsuranceClaim> listClaims(Long insuranceId, String status, Integer pageNum, Integer pageSize);
    InsuranceClaim getById(Long id);
    InsuranceClaim create(InsuranceClaim claim);
    InsuranceClaim update(Long id, InsuranceClaim claim);
    void delete(Long id);
}