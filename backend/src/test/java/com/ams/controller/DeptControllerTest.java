package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.DeptCreateDTO;
import com.ams.entity.Dept;
import com.ams.service.DeptService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class DeptControllerTest {

    @Mock
    private DeptService deptService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new DeptController(deptService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldReturnDepts() throws Exception {
        when(deptService.queryDepts(eq(null))).thenReturn(List.of(deptMap()));

        mockMvc.perform(get("/depts/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].dept_name").value("研发部"))
                .andExpect(jsonPath("$.data[0].dept_code").value("RD"));

        verify(deptService).queryDepts(eq(null));
    }

    @Test
    void getByIdShouldReturnDeptDetail() throws Exception {
        when(deptService.getDeptById(1L)).thenReturn(dept(1L));

        mockMvc.perform(get("/depts/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.name").value("研发部"));

        verify(deptService).getDeptById(1L);
    }

    @Test
    void createShouldSucceedWithValidPayload() throws Exception {
        when(deptService.createDept(any(DeptCreateDTO.class))).thenReturn(dept(1L));

        mockMvc.perform(post("/depts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"研发部\",\"deptCode\":\"RD\",\"parentId\":0}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.name").value("研发部"));

        verify(deptService).createDept(any(DeptCreateDTO.class));
    }

    @Test
    void createShouldReturn400WhenNameMissing() throws Exception {
        mockMvc.perform(post("/depts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deptCode\":\"RD\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    private Map<String, Object> deptMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("id", 1);
        map.put("dept_name", "研发部");
        map.put("dept_code", "RD");
        map.put("parent_id", 0);
        return map;
    }

    private Dept dept(Long id) {
        Dept dept = new Dept();
        dept.setId(id);
        dept.setName("研发部");
        dept.setParentId(0L);
        dept.setOrderNum(0);
        dept.setStatus("1");
        return dept;
    }
}
