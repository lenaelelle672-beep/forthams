package com.ams.controller;

import com.ams.entity.StocktakingTask;
import com.ams.mapper.StocktakingCycleMapper;
import com.ams.security.LoginUser;
import com.ams.service.StocktakingService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "server.servlet.context-path=/test",
    "ams.security.method-permission-test-bypass=false"
})
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Stocktaking Permission Controller Tests")
class StocktakingPermissionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StocktakingService stocktakingService;

    @MockBean
    private StocktakingCycleMapper stocktakingCycleMapper;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Should protect every stocktaking cycle endpoint with seeded permissions")
    void shouldProtectStocktakingCycleEndpoints() throws Exception {
        Map<String, String> expected = Map.of(
            "list", "@ss.hasPermi('stocktaking:cycle:query')",
            "create", "@ss.hasPermi('stocktaking:cycle:add')",
            "get", "@ss.hasPermi('stocktaking:cycle:query')",
            "getStats", "@ss.hasPermi('stocktaking:cycle:query')",
            "assignTasks", "@ss.hasPermi('stocktaking:cycle:edit')",
            "pause", "@ss.hasPermi('stocktaking:cycle:edit')",
            "resume", "@ss.hasPermi('stocktaking:cycle:edit')",
            "complete", "@ss.hasPermi('stocktaking:cycle:edit')",
            "getTasks", "@ss.hasPermi('stocktaking:cycle:query')")
        ;

        for (Map.Entry<String, String> entry : expected.entrySet()) {
            assertPreAuthorize(StocktakingCycleController.class, entry.getKey(), entry.getValue());
        }
    }

    @Test
    @DisplayName("Should protect every stocktaking task endpoint with seeded permissions")
    void shouldProtectStocktakingTaskEndpoints() throws Exception {
        Map<String, String> expected = Map.of(
            "get", "@ss.hasPermi('stocktaking:cycle:query')",
            "scan", "@ss.hasPermi('stocktaking:cycle:edit')",
            "adjust", "@ss.hasPermi('stocktaking:cycle:edit')")
        ;

        for (Map.Entry<String, String> entry : expected.entrySet()) {
            assertPreAuthorize(StocktakingTaskController.class, entry.getKey(), entry.getValue());
        }
    }

    @Test
    @DisplayName("Should reject stocktaking cycle write request without permission")
    void shouldRejectCycleWriteWithoutPermission() throws Exception {
        authenticateWithPermissions();

        mockMvc.perform(post("/test/stocktaking/cycles/{id}/assign", 7L)
                .contextPath("/test")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value(403));

        verify(stocktakingService, never()).assignTasks(any(), any(), any());
    }

    @Test
    @DisplayName("Should allow stocktaking task query with matching permission")
    void shouldAllowTaskQueryWithPermission() throws Exception {
        authenticateWithPermissions("stocktaking:cycle:query");
        StocktakingTask task = new StocktakingTask();
        task.setId(5L);
        when(stocktakingService.getTaskById(5L)).thenReturn(task);

        mockMvc.perform(get("/test/stocktaking/tasks/{id}", 5L)
                .contextPath("/test")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.id").value(5));

        verify(stocktakingService).getTaskById(5L);
    }

    private void assertPreAuthorize(Class<?> controllerClass, String methodName, String expectedValue) throws Exception {
        Method method = findMethod(controllerClass, methodName);
        PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);
        assertNotNull(preAuthorize, methodName + " should declare @PreAuthorize");
        assertEquals(expectedValue, preAuthorize.value());
    }

    private Method findMethod(Class<?> controllerClass, String methodName) throws Exception {
        for (Method method : controllerClass.getDeclaredMethods()) {
            if (method.getName().equals(methodName)) {
                return method;
            }
        }
        throw new NoSuchMethodException(controllerClass.getSimpleName() + "." + methodName);
    }

    private void authenticateWithPermissions(String... permissions) {
        LoginUser loginUser = new LoginUser(
                88L,
                1L,
                "dept:1",
                "operator",
                "",
                List.of("USER"),
                List.of(permissions),
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(loginUser, null, loginUser.getAuthorities()));
    }
}
