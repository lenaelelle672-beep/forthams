package com.ams.controller;

import com.ams.entity.Location;
import com.ams.service.LocationService;
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

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Location Controller Tests")
class LocationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private LocationService locationService;

    // ─── /cascade tests ──────────────────────────────────────────

    @Test
    @DisplayName("cascade: 空根节点应返回空数组")
    void cascade_emptyRoots_returnsEmptyArray() throws Exception {
        when(locationService.findRootLocations()).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/locations/cascade")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray())
            .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    @DisplayName("cascade: 有子节点时应返回树形结构")
    void cascade_withChildren_returnsTree() throws Exception {
        Location root = new Location();
        root.setId(1L);
        root.setName("北京市");
        root.setLocationCode("BEIJING");

        Location child = new Location();
        child.setId(2L);
        child.setName("海淀区");
        child.setLocationCode("HAIDIAN");

        when(locationService.findRootLocations()).thenReturn(List.of(root));
        when(locationService.findChildrenByParentId(1L)).thenReturn(List.of(child));
        when(locationService.findChildrenByParentId(2L)).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/locations/cascade")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray())
            .andExpect(jsonPath("$.data[0].code").value("BEIJING"))
            .andExpect(jsonPath("$.data[0].name").value("北京市"))
            .andExpect(jsonPath("$.data[0].children").isArray())
            .andExpect(jsonPath("$.data[0].children[0].code").value("HAIDIAN"))
            .andExpect(jsonPath("$.data[0].children[0].name").value("海淀区"));
    }

    @Test
    @DisplayName("cascade: 叶子节点无 children 字段")
    void cascade_leafNode_noChildrenField() throws Exception {
        Location root = new Location();
        root.setId(1L);
        root.setName("上海市");
        root.setLocationCode("SHANGHAI");

        when(locationService.findRootLocations()).thenReturn(List.of(root));
        when(locationService.findChildrenByParentId(1L)).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/locations/cascade")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data[0].code").value("SHANGHAI"))
            .andExpect(jsonPath("$.data[0].name").value("上海市"))
            .andExpect(jsonPath("$.data[0].children").doesNotExist());
    }

    // ─── /list tests ─────────────────────────────────────────────

    @Test
    @DisplayName("list: 应返回根位置列表")
    void list_returnsRootLocations() throws Exception {
        Location loc = new Location();
        loc.setId(1L);
        loc.setName("仓库A");

        when(locationService.findRootLocations()).thenReturn(List.of(loc));

        mockMvc.perform(get("/locations/list")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray())
            .andExpect(jsonPath("$.data[0].name").value("仓库A"));
    }

    @Test
    @DisplayName("list: 无数据时返回空数组")
    void list_empty_returnsEmptyArray() throws Exception {
        when(locationService.findRootLocations()).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/locations/list")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isEmpty());
    }

    // ─── /root tests ─────────────────────────────────────────────

    @Test
    @DisplayName("root: 应返回根位置列表（与 /list 相同）")
    void root_returnsRootLocations() throws Exception {
        Location loc = new Location();
        loc.setId(1L);
        loc.setName("总部");

        when(locationService.findRootLocations()).thenReturn(List.of(loc));

        mockMvc.perform(get("/locations/root")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data[0].name").value("总部"));
    }

    // ─── /{id} tests ─────────────────────────────────────────────

    @Test
    @DisplayName("getById: 返回指定位置")
    void getById_returnsLocation() throws Exception {
        Location loc = new Location();
        loc.setId(1L);
        loc.setName("仓库B");

        when(locationService.findById(1L)).thenReturn(loc);

        mockMvc.perform(get("/locations/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.name").value("仓库B"));
    }

    // ─── CRUD tests ──────────────────────────────────────────────

    @Test
    @DisplayName("create: 成功创建位置")
    void create_success() throws Exception {
        String body = "{\"name\":\"新位置\",\"locationCode\":\"LOC001\"}";

        mockMvc.perform(post("/locations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("update: 成功更新位置")
    void update_success() throws Exception {
        String body = "{\"name\":\"更新位置\",\"locationCode\":\"LOC002\"}";

        mockMvc.perform(put("/locations/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("delete: 成功删除位置")
    void delete_success() throws Exception {
        mockMvc.perform(delete("/locations/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("reorder: 成功重排位置顺序")
    void reorder_success() throws Exception {
        String body = "[{\"id\":1,\"sortOrder\":1},{\"id\":2,\"parentId\":1,\"sortOrder\":2}]";

        when(locationService.findById(1L)).thenReturn(new Location());
        when(locationService.findById(2L)).thenReturn(new Location());

        mockMvc.perform(put("/locations/reorder")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));
    }
}
