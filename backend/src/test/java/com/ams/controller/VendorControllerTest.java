package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.entity.Vendor;
import com.ams.service.VendorService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class VendorControllerTest {

    @Mock
    private VendorService vendorService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new VendorController(vendorService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldReturnVendors() throws Exception {
        when(vendorService.list()).thenReturn(List.of(vendor(1L)));

        mockMvc.perform(get("/vendors/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].vendorCode").value("V001"))
                .andExpect(jsonPath("$.data[0].name").value("供应商A"));

        verify(vendorService).list();
    }

    @Test
    void getByIdShouldReturnVendorDetail() throws Exception {
        when(vendorService.getVendorById(1L)).thenReturn(vendor(1L));

        mockMvc.perform(get("/vendors/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.vendorCode").value("V001"))
                .andExpect(jsonPath("$.data.name").value("供应商A"));

        verify(vendorService).getVendorById(1L);
    }

    @Test
    void createShouldNullOutMassAssignmentFields() throws Exception {
        when(vendorService.createVendor(any(Vendor.class))).thenReturn(vendor(1L));

        mockMvc.perform(post("/vendors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":999,\"name\":\"供应商A\",\"vendorCode\":\"V001\","
                                + "\"deleted\":1,\"createTime\":\"2026-01-01T00:00:00\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        ArgumentCaptor<Vendor> captor = ArgumentCaptor.forClass(Vendor.class);
        verify(vendorService).createVendor(captor.capture());
        Vendor captured = captor.getValue();
        assertNull(captured.getId(), "id should be nulled by mass-assignment guard");
        assertNull(captured.getCreateTime(), "createTime should be nulled by mass-assignment guard");
        assertEquals(0, captured.getDeleted(), "deleted should be reset to 0");
        assertEquals("供应商A", captured.getName(), "client-supplied business fields should be retained");
    }

    private Vendor vendor(Long id) {
        Vendor vendor = new Vendor();
        vendor.setId(id);
        vendor.setName("供应商A");
        vendor.setVendorCode("V001");
        vendor.setStatus(1);
        return vendor;
    }
}
