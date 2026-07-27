package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.entity.Location;
import com.ams.service.LocationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

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
class LocationControllerTest {

    @Mock
    private LocationService locationService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new LocationController(locationService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldReturnRootLocations() throws Exception {
        when(locationService.findRootLocations()).thenReturn(List.of(location(1L)));

        mockMvc.perform(get("/locations/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].locationCode").value("HQ"))
                .andExpect(jsonPath("$.data[0].name").value("总部"));

        verify(locationService).findRootLocations();
    }

    @Test
    void getByIdShouldReturnLocationDetail() throws Exception {
        when(locationService.findById(1L)).thenReturn(location(1L));

        mockMvc.perform(get("/locations/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.locationCode").value("HQ"))
                .andExpect(jsonPath("$.data.name").value("总部"));

        verify(locationService).findById(1L);
    }

    @Test
    void createShouldNullOutMassAssignmentFields() throws Exception {
        mockMvc.perform(post("/locations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":999,\"name\":\"总部\",\"locationCode\":\"HQ\","
                                + "\"deleted\":1,\"createTime\":\"2026-01-01T00:00:00\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        ArgumentCaptor<Location> captor = ArgumentCaptor.forClass(Location.class);
        verify(locationService).insert(captor.capture());
        Location captured = captor.getValue();
        assertNull(captured.getId(), "id should be nulled by mass-assignment guard");
        assertNull(captured.getCreateTime(), "createTime should be nulled by mass-assignment guard");
        assertEquals(0, captured.getDeleted(), "deleted should be reset to 0");
        assertEquals("总部", captured.getName(), "client-supplied business fields should be retained");
    }

    private Location location(Long id) {
        Location location = new Location();
        location.setId(id);
        location.setName("总部");
        location.setLocationCode("HQ");
        location.setStatus(1);
        return location;
    }
}
