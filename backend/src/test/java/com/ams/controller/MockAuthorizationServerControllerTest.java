package com.ams.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@ActiveProfiles("test")
@DisplayName("Mock Authorization Server Controller Tests")
class MockAuthorizationServerControllerTest {

    @Autowired
    private ApplicationContext applicationContext;

    @Test
    @DisplayName("Should not load mock OAuth2 controller by default")
    void mockOAuth2ControllerIsDisabledByDefault() {
        assertTrue(applicationContext.getBeansOfType(MockAuthorizationServerController.class).isEmpty());
    }
}
