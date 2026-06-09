package com.ams.controller;

import com.ams.context.TenantContext;
import com.ams.security.LoginUser;
import com.ams.service.ABCClassificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "server.servlet.context-path=/api",
    "ams.security.method-permission-test-bypass=false"
})
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("ABC Classification Controller Tests")
class ABCClassificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ABCClassificationService abcClassificationService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    @DisplayName("Should protect ABC endpoints with RuoYi permission expressions")
    void shouldUseRuoYiPermissionExpressions() throws Exception {
        Map<String, String> expected = Map.of(
                "reclassifyAll", "@ss.hasPermi('abc:reclassify')",
                "reclassifyAsset", "@ss.hasPermi('abc:reclassify')",
                "reclassifyByCategoryIds", "@ss.hasPermi('abc:reclassify')",
                "getStatistics", "@ss.hasPermi('abc:query')",
                "getByAssetId", "@ss.hasPermi('abc:query')");

        for (Map.Entry<String, String> entry : expected.entrySet()) {
            Method method = findMethod(entry.getKey());
            PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);
            assertNotNull(preAuthorize, entry.getKey() + " should declare @PreAuthorize");
            assertEquals(entry.getValue(), preAuthorize.value());
        }
    }

    @Test
    @DisplayName("Should reject ABC write without RuoYi permission")
    void shouldRejectWriteWithoutPermission() throws Exception {
        authenticateWithPermissions();

        mockMvc.perform(post("/api/abc/reclassify")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value(403));

        verify(abcClassificationService, never()).reclassifyAll();
    }

    @Test
    @DisplayName("Should allow ABC query with matching RuoYi permission")
    void shouldAllowQueryWithPermission() throws Exception {
        authenticateWithPermissions("abc:query");
        when(abcClassificationService.getStatistics())
                .thenReturn(new ABCClassificationService.ClassificationStatistics());

        mockMvc.perform(get("/api/abc/statistics")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(abcClassificationService).getStatistics();
    }

    private Method findMethod(String methodName) throws NoSuchMethodException {
        for (Method method : ABCClassificationController.class.getDeclaredMethods()) {
            if (method.getName().equals(methodName)) {
                return method;
            }
        }
        throw new NoSuchMethodException("ABCClassificationController." + methodName);
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
