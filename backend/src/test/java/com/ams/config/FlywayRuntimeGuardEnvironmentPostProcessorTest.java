package com.ams.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FlywayRuntimeGuardEnvironmentPostProcessorTest {

    private final FlywayRuntimeGuardEnvironmentPostProcessor processor =
            new FlywayRuntimeGuardEnvironmentPostProcessor();

    @Test
    void rejectsFinalEffectiveFlywayEnablement() {
        MockEnvironment environment = new MockEnvironment().withProperty("spring.flyway.enabled", "true");

        assertThatThrownBy(() -> processor.postProcessEnvironment(environment, new SpringApplication()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("spring.flyway.enabled");
    }

    @Test
    void permitsTheOnlySupportedDisabledRuntimeSetting() {
        MockEnvironment environment = new MockEnvironment().withProperty("spring.flyway.enabled", "false");

        assertThatCode(() -> processor.postProcessEnvironment(environment, new SpringApplication()))
                .doesNotThrowAnyException();
    }
}
