package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.VendorPortalLoginRequest;
import com.ams.entity.Contract;
import com.ams.entity.Vendor;
import com.ams.mapper.ContractMapper;
import com.ams.mapper.VendorMapper;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VendorPortalControllerTest {

    @Mock
    private VendorMapper vendorMapper;

    @Mock
    private ContractMapper contractMapper;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    void loginShouldIssueVendorPortalTokenWithoutDefaultTenant() {
        Vendor vendor = vendor(7L);
        VendorPortalLoginRequest request = new VendorPortalLoginRequest();
        request.setVendorCode("V-001");
        request.setPassword("secret");

        when(vendorMapper.selectOne(any())).thenReturn(vendor);
        when(passwordEncoder.matches("secret", "encoded")).thenReturn(true);
        when(jwtUtil.generateToken("vendor_7", 7L, "vendor-portal")).thenReturn("vendor-token");

        Result<Map<String, Object>> result = controller().login(request);

        assertThat(result.getCode()).isEqualTo(200);
        assertThat(result.getData()).containsEntry("token", "vendor-token");
        verify(jwtUtil).generateToken("vendor_7", 7L, "vendor-portal");

        ArgumentCaptor<String> tenantCaptor = ArgumentCaptor.forClass(String.class);
        verify(jwtUtil).generateToken(any(), any(), tenantCaptor.capture());
        assertThat(tenantCaptor.getValue()).isNotEqualTo("default");
    }

    @Test
    void contractsShouldRequireMatchingVendorToken() {
        Contract contract = new Contract();
        contract.setId(100L);

        when(jwtUtil.getUsernameFromToken("vendor-token")).thenReturn("vendor_7");
        when(jwtUtil.getTenantIdFromToken("vendor-token")).thenReturn("vendor-portal");
        when(jwtUtil.validateToken("vendor-token", "vendor_7")).thenReturn(true);
        when(contractMapper.selectList(any(Wrapper.class))).thenReturn(List.of(contract));

        Result<List<Contract>> result = controller().getContracts(7L, "Bearer vendor-token");

        assertThat(result.getCode()).isEqualTo(200);
        assertThat(result.getData()).containsExactly(contract);
    }

    @Test
    void contractsShouldRejectMissingVendorToken() {
        Result<List<Contract>> result = controller().getContracts(7L, null);

        assertThat(result.getCode()).isEqualTo(401);
        assertThat(result.getMessage()).isEqualTo("供应商登录已过期");
        verify(contractMapper, never()).selectList(any());
    }

    @Test
    void profileShouldRejectTokenForDifferentVendor() {
        when(jwtUtil.getUsernameFromToken("vendor-token")).thenReturn("vendor_8");

        Result<Vendor> result = controller().getProfile(7L, "Bearer vendor-token");

        assertThat(result.getCode()).isEqualTo(401);
        assertThat(result.getMessage()).isEqualTo("供应商登录已过期");
        verify(vendorMapper, never()).selectById(any());
    }

    @Test
    void profileShouldStripPasswordWhenTokenIsValid() {
        Vendor vendor = vendor(7L);
        stubValidVendorToken(7L, "vendor-token");
        when(vendorMapper.selectById(7L)).thenReturn(vendor);

        Result<Vendor> result = controller().getProfile(7L, "Bearer vendor-token");

        assertThat(result.getCode()).isEqualTo(200);
        assertThat(result.getData().getId()).isEqualTo(7L);
        assertThat(result.getData().getPassword()).isNull();
    }

    @Test
    void contractDetailShouldRejectTokenWithWrongTenant() {
        when(jwtUtil.getUsernameFromToken("vendor-token")).thenReturn("vendor_7");
        when(jwtUtil.getTenantIdFromToken("vendor-token")).thenReturn("dept:1");

        Result<Contract> result = controller().getContractDetail(100L, 7L, "Bearer vendor-token");

        assertThat(result.getCode()).isEqualTo(401);
        assertThat(result.getMessage()).isEqualTo("供应商登录已过期");
        verify(contractMapper, never()).selectOne(any());
    }

    @Test
    void contractDetailShouldRejectContractsOutsideVendorScope() {
        stubValidVendorToken(7L, "vendor-token");
        when(contractMapper.selectOne(any(Wrapper.class))).thenReturn(null);

        Result<Contract> result = controller().getContractDetail(100L, 7L, "Bearer vendor-token");

        assertThat(result.getCode()).isEqualTo(500);
        assertThat(result.getMessage()).isEqualTo("合同不存在或无权查看");
        verify(contractMapper).selectOne(any(Wrapper.class));
    }

    private VendorPortalController controller() {
        return new VendorPortalController(vendorMapper, contractMapper, jwtUtil, passwordEncoder);
    }

    private void stubValidVendorToken(Long vendorId, String token) {
        when(jwtUtil.getUsernameFromToken(token)).thenReturn("vendor_" + vendorId);
        when(jwtUtil.getTenantIdFromToken(token)).thenReturn("vendor-portal");
        when(jwtUtil.validateToken(eq(token), eq("vendor_" + vendorId))).thenReturn(true);
    }

    private static Vendor vendor(Long id) {
        Vendor vendor = new Vendor();
        vendor.setId(id);
        vendor.setName("测试供应商");
        vendor.setVendorCode("V-001");
        vendor.setPassword("encoded");
        vendor.setPortalEnabled(1);
        return vendor;
    }
}
