package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.VendorPortalLoginRequest;
import com.ams.entity.Contract;
import com.ams.entity.Vendor;
import com.ams.mapper.ContractMapper;
import com.ams.mapper.VendorMapper;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/vendor-portal")
@RequiredArgsConstructor
public class VendorPortalController {

    private final VendorMapper vendorMapper;
    private final ContractMapper contractMapper;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    /**
     * 供应商门户登录
     */
    @PostMapping("/login")
    public Result<Map<String, Object>> login(@RequestBody VendorPortalLoginRequest request) {
        Vendor vendor = vendorMapper.selectOne(new LambdaQueryWrapper<Vendor>()
                .eq(Vendor::getVendorCode, request.getVendorCode())
                .eq(Vendor::getPortalEnabled, 1));
        if (vendor == null) {
            return Result.error("供应商不存在或门户未启用");
        }
        if (vendor.getPassword() == null || !passwordEncoder.matches(request.getPassword(), vendor.getPassword())) {
            return Result.error("密码错误");
        }
        String token = jwtUtil.generateToken("vendor_" + vendor.getId(), vendor.getId(),
                "default");
        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        result.put("vendorId", vendor.getId());
        result.put("vendorName", vendor.getName());
        return Result.success("登录成功", result);
    }

    /**
     * 供应商信息（需登录后通过 token 获取 vendorId）
     */
    @GetMapping("/profile")
    public Result<Vendor> getProfile(@RequestParam Long vendorId) {
        Vendor vendor = vendorMapper.selectById(vendorId);
        if (vendor != null) vendor.setPassword(null);
        return Result.success(vendor);
    }

    /**
     * 查看自己的合同列表
     */
    @GetMapping("/contracts")
    public Result<List<Contract>> getContracts(@RequestParam Long vendorId) {
        List<Contract> contracts = contractMapper.selectList(new LambdaQueryWrapper<Contract>()
                .eq(Contract::getVendorId, vendorId)
                .orderByDesc(Contract::getCreatedAt));
        return Result.success(contracts);
    }

    /**
     * 查看合同详情
     */
    @GetMapping("/contracts/{id}")
    public Result<Contract> getContractDetail(@PathVariable Long id, @RequestParam Long vendorId) {
        Contract contract = contractMapper.selectOne(new LambdaQueryWrapper<Contract>()
                .eq(Contract::getId, id)
                .eq(Contract::getVendorId, vendorId));
        if (contract == null) return Result.error("合同不存在或无权查看");
        return Result.success(contract);
    }
}
