package com.ams.controller;

import com.ams.dto.DeptCreateDTO;
import com.ams.dto.DeptUpdateDTO;
import com.ams.entity.Dept;
import com.ams.service.DeptService;
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

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Dept Controller Tests")
class DeptControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DeptService deptService;

    @Test
    @DisplayName("Should return dept list from root endpoint")
    void testRootList() throws Exception {
        Map<String, Object> deptMap = Map.of("id", 1, "deptName", "IT Department");
        when(deptService.queryDepts(null)).thenReturn(List.of(deptMap));

        mockMvc.perform(get("/depts")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray());

        verify(deptService).queryDepts(null);
    }

    @Test
    @DisplayName("Should return dept list with keyword filter")
    void testList() throws Exception {
        Map<String, Object> deptMap = Map.of("id", 1, "name", "IT Department");
        when(deptService.queryDepts("IT")).thenReturn(List.of(deptMap));

        mockMvc.perform(get("/depts/list")
                .param("keyword", "IT")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray());

        verify(deptService).queryDepts("IT");
    }

    @Test
    @DisplayName("Should return dept tree")
    void testTree() throws Exception {
        Dept dept = new Dept();
        dept.setId(1L);
        when(deptService.listAllDepts()).thenReturn(List.of(dept));

        mockMvc.perform(get("/depts/tree")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray());

        verify(deptService).listAllDepts();
    }

    @Test
    @DisplayName("Should return dept by ID")
    void testGetById() throws Exception {
        Dept dept = new Dept();
        dept.setId(1L);
        when(deptService.getDeptById(1L)).thenReturn(dept);

        mockMvc.perform(get("/depts/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.id").value(1));

        verify(deptService).getDeptById(1L);
    }

    @Test
    @DisplayName("Should create dept successfully")
    void testCreate() throws Exception {
        DeptCreateDTO dto = new DeptCreateDTO();
        dto.setName("New Dept");
        dto.setDeptCode("DEPT001");

        Dept saved = new Dept();
        saved.setId(10L);
        when(deptService.createDept(any(DeptCreateDTO.class))).thenReturn(saved);

        mockMvc.perform(post("/depts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(deptService).createDept(any(DeptCreateDTO.class));
    }

    @Test
    @DisplayName("Should update dept successfully")
    void testUpdate() throws Exception {
        DeptUpdateDTO dto = new DeptUpdateDTO();
        dto.setName("Updated Dept");

        Dept updated = new Dept();
        updated.setId(1L);
        when(deptService.updateDept(eq(1L), any(DeptUpdateDTO.class))).thenReturn(updated);

        mockMvc.perform(put("/depts/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(deptService).updateDept(eq(1L), any(DeptUpdateDTO.class));
    }

    @Test
    @DisplayName("Should delete dept successfully")
    void testDelete() throws Exception {
        mockMvc.perform(delete("/depts/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(deptService).deleteDept(1L);
    }
}
