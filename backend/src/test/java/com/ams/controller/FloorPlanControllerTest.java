package com.ams.controller;

import com.ams.common.exception.BusinessException;
import com.ams.entity.FloorPlan;
import com.ams.entity.FloorPlanAsset;
import com.ams.service.FloorPlanService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("FloorPlan Controller Tests")
class FloorPlanControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private FloorPlanService floorPlanService;

    @Nested @DisplayName("查询端点")
    class QueryEndpoints {
        @Test @DisplayName("list: 分页返回平面图列表")
        void list_shouldReturnPagedResult() throws Exception {
            Page<FloorPlan> page = new Page<>(1,10);
            page.setRecords(List.of(plan(1L,"平面图A"))); page.setTotal(1);
            when(floorPlanService.listPage(1,10,null)).thenReturn(page);
            mockMvc.perform(get("/floor-plans").param("page","1").param("pageSize","10").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.records").isArray()).andExpect(jsonPath("$.data.total").value(1));
        }
        @Test @DisplayName("list: 支持 keyword 搜索")
        void list_withKeyword() throws Exception {
            when(floorPlanService.listPage(1,10,"建筑A")).thenReturn(new Page<>(1,10));
            mockMvc.perform(get("/floor-plans").param("page","1").param("pageSize","10").param("keyword","建筑A").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        }
        @Test @DisplayName("detail: 返回平面图详情")
        void detail_shouldReturnPlan() throws Exception {
            when(floorPlanService.getById(1L)).thenReturn(plan(1L,"平面图A"));
            mockMvc.perform(get("/floor-plans/{id}",1L).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.name").value("平面图A"));
        }
        @Test @DisplayName("detail: 不存在返回错误")
        void detail_notFound() throws Exception {
            when(floorPlanService.getById(999L)).thenThrow(new BusinessException("平面图不存在"));
            mockMvc.perform(get("/floor-plans/{id}",999L).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(500));
        }
        @Test @DisplayName("getAssets: 返回资产列表")
        void getAssets() throws Exception {
            FloorPlanAsset a = new FloorPlanAsset(); a.setId(1L); a.setPlanId(1L); a.setAssetId(101L);
            when(floorPlanService.getPlanAssets(1L)).thenReturn(List.of(a));
            mockMvc.perform(get("/floor-plans/{id}/assets",1L).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].assetId").value(101));
        }
    }

    @Nested @DisplayName("写操作端点")
    class WriteEndpoints {
        @Test @DisplayName("create: 成功创建")
        void create() throws Exception {
            FloorPlan created = plan(1L,"新平面图"); created.setBuilding("A栋");
            when(floorPlanService.create(any(FloorPlan.class))).thenReturn(created);
            mockMvc.perform(post("/floor-plans").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"新平面图\",\"building\":\"A栋\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        }
        @Test @DisplayName("update: 成功更新")
        void update() throws Exception {
            when(floorPlanService.update(eq(1L),any(FloorPlan.class))).thenReturn(plan(1L,"更新名称"));
            mockMvc.perform(put("/floor-plans/{id}",1L).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"更新名称\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        }
        @Test @DisplayName("delete: 成功删除")
        void testDelete() throws Exception {
            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/floor-plans/{id}",1L).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        }
        @Test @DisplayName("placeAsset: 成功放置资产标记")
        void placeAsset() throws Exception {
            FloorPlanAsset asset = new FloorPlanAsset(); asset.setId(1L); asset.setPlanId(1L); asset.setAssetId(101L);
            when(floorPlanService.placeAsset(eq(1L),eq(101L),any(BigDecimal.class),any(BigDecimal.class),eq("标记"))).thenReturn(asset);
            mockMvc.perform(post("/floor-plans/{id}/assets",1L).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("assetId",101,"posX",10.5,"posY",20.3,"label","标记"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.data.assetId").value(101));
        }
        @Test @DisplayName("removeAsset: 成功移除标记")
        void testRemoveAsset() throws Exception {
            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/floor-plans/{planId}/assets/{assetId}",1L,101L).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        }
    }

    private FloorPlan plan(Long id, String name) { FloorPlan p = new FloorPlan(); p.setId(id); p.setName(name); return p; }
}
