package com.ams.controller;

import com.ams.entity.Vendor;
import com.ams.service.VendorService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Vendor Controller Tests")
class VendorControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private VendorService vendorService;

    @Test
    @DisplayName("Should return all vendors when listing")
    void testList() throws Exception {
        Vendor v1 = new Vendor();
        v1.setId(1L);
        v1.setName("Supplier A");
        Vendor v2 = new Vendor();
        v2.setId(2L);
        v2.setName("Supplier B");
        List<Vendor> vendors = Arrays.asList(v1, v2);

        when(vendorService.list()).thenReturn(vendors);

        mockMvc.perform(get("/vendors/list")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray())
            .andExpect(jsonPath("$.data.length()").value(2));

        verify(vendorService).list();
    }

    @Test
    @DisplayName("Should return empty list when no vendors")
    void testListEmpty() throws Exception {
        when(vendorService.list()).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/vendors/list")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray())
            .andExpect(jsonPath("$.data.length()").value(0));

        verify(vendorService).list();
    }

    @Test
    @DisplayName("Should return vendor by ID")
    void testGetById() throws Exception {
        Vendor vendor = new Vendor();
        vendor.setId(1L);
        vendor.setName("Supplier A");
        vendor.setVendorCode("V001");

        when(vendorService.getVendorById(1L)).thenReturn(vendor);

        mockMvc.perform(get("/vendors/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.id").value(1))
            .andExpect(jsonPath("$.data.name").value("Supplier A"));

        verify(vendorService).getVendorById(1L);
    }

    @Test
    @DisplayName("Should create vendor successfully")
    void testCreate() throws Exception {
        Vendor vendor = new Vendor();
        vendor.setName("New Supplier");
        vendor.setVendorCode("V003");
        vendor.setContactPerson("John");

        Vendor saved = new Vendor();
        saved.setId(3L);
        saved.setName("New Supplier");

        when(vendorService.createVendor(any(Vendor.class))).thenReturn(saved);

        mockMvc.perform(post("/vendors")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(vendor)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(vendorService).createVendor(any(Vendor.class));
    }

    @Test
    @DisplayName("Should update vendor successfully")
    void testUpdate() throws Exception {
        Vendor vendor = new Vendor();
        vendor.setName("Updated Supplier");

        Vendor updated = new Vendor();
        updated.setId(1L);
        updated.setName("Updated Supplier");

        when(vendorService.updateVendor(eq(1L), any(Vendor.class))).thenReturn(updated);

        mockMvc.perform(put("/vendors/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(vendor)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(vendorService).updateVendor(eq(1L), any(Vendor.class));
    }

    @Test
    @DisplayName("Should delete vendor successfully")
    void testDelete() throws Exception {
        mockMvc.perform(delete("/vendors/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(vendorService).deleteVendor(1L);
    }
}
