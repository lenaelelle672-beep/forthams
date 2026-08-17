package com.ams.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.MapPropertySource;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

class DatabaseConnectionSecurityValidatorTest {

    @Test
    void rejectsMysqlWithoutTlsByDefault() {
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams", true, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("VERIFY_IDENTITY");
    }

    @Test
    void acceptsVerifiedMysqlTlsConfiguration() {
        assertThatCode(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_IDENTITY", true, false).validate())
                .doesNotThrowAnyException();
    }

    @Test
    void permitsInsecureMysqlOnlyForExplicitLoopbackDevelopmentException() {
        assertThatCode(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://127.0.0.1:3306/ams", false, true).validate())
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams", false, true).validate())
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsHostsThatOnlyStartWithALoopbackName() {
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://127.0.0.1.example.test:3306/ams", false, true).validate())
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://localhost.example.test:3306/ams", false, true).validate())
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsConflictingTlsParameters() {
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=REQUIRED&sslMode=DISABLED", true, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("VERIFY_IDENTITY");
    }

    @Test
    void rejectsTlsModesWithoutIdentityVerification() {
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_CA", true, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("VERIFY_IDENTITY");
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=REQUIRED", true, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("VERIFY_IDENTITY");
    }

    @Test
    void rejectsLegacyTlsFlagsAndDuplicateTlsModesEvenWhenVerifyIdentityIsPresent() {
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_IDENTITY&useSSL=true", true, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("VERIFY_IDENTITY");
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_IDENTITY&verifyServerCertificate=true", true, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("VERIFY_IDENTITY");
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_IDENTITY&sslMode=VERIFY_IDENTITY", true, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("VERIFY_IDENTITY");
    }

    @Test
    void decodesAndNormalizesConnectorJQueryPropertiesBeforeEvaluatingTls() {
        assertThatCode(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?%73sl%4dode=verify%5fidentity", true, false).validate())
                .doesNotThrowAnyException();
        assertThatCode(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?SSLMODE=VERIFY_IDENTITY", true, false).validate())
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY%5fCA", true, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("VERIFY_IDENTITY");
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_IDENTITY&use%53SL=true", true, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("VERIFY_IDENTITY");
    }

    @Test
    void rejectsCaseInsensitiveDuplicateAndSemicolonAmbiguousConnectorJParameters() {
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_IDENTITY&SSLMODE=REQUIRED", true, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("VERIFY_IDENTITY");
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_IDENTITY;useSSL=false", true, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("VERIFY_IDENTITY");
    }

    @Test
    void rejectsHikariDriverPropertiesThatCouldOverrideTheVerifiedUrl() {
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_IDENTITY", true, false,
                Map.of("sslMode", "REQUIRED"), null).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Hikari");
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_IDENTITY", true, false,
                Map.of("serverTimezone", "UTC"), null).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Hikari");
    }

    @Test
    void rejectsHikariJdbcUrlOverrideInsteadOfValidatingTheWrongConnection() {
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_IDENTITY", true, false,
                Map.of(), "jdbc:mysql://db.internal:3306/ams?sslMode=REQUIRED").validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Hikari jdbc-url");
    }

    @Test
    void rejectsHikariDataSourceModesThatDoNotUseTheValidatedJdbcUrl() {
        assertThatThrownBy(() -> new DatabaseConnectionSecurityValidator(
                "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_IDENTITY", true, false,
                Map.of(), null, "com.mysql.cj.jdbc.MysqlDataSource", null).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("data-source-class-name");
    }

    @Test
    void environmentValidationReadsHikariDataSourceProperties() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("spring.datasource.url", "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_IDENTITY")
                .withProperty("spring.datasource.hikari.data-source-properties.sslMode", "REQUIRED");

        assertThatThrownBy(() -> new DatabaseConnectionSecurityEnvironmentPostProcessor()
                .postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Hikari");
    }

    @Test
    void productionEnvironmentRejectsDatasourceJndiNameBeforeDataSourceCreation() {
        MockEnvironment environment = productionMysqlEnvironment()
                .withProperty("spring.datasource.jndi-name", "java:comp/env/jdbc/ams");

        assertThatThrownBy(() -> new DatabaseConnectionSecurityEnvironmentPostProcessor()
                .postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("jndi-name");
    }

    @Test
    void productionEnvironmentFailsClosedWhenNoJdbcUrlIsConfigured() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");

        assertThatThrownBy(() -> new DatabaseConnectionSecurityEnvironmentPostProcessor()
                .postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("数据库连接地址");
    }

    @Test
    void productionEnvironmentRejectsEnvironmentStyleAndLooseJndiPropertyNames() {
        MockEnvironment environment = productionMysqlEnvironment();
        environment.getPropertySources().addFirst(new MapPropertySource("environment", Map.of(
                "SPRING_DATASOURCE_JNDI_NAME", "java:comp/env/jdbc/ams",
                "spring_datasource_jndi_name", "java:comp/env/jdbc/ignored")));

        assertThatThrownBy(() -> new DatabaseConnectionSecurityEnvironmentPostProcessor()
                .postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("jndi-name");
    }

    @Test
    void productionEnvironmentRejectsAlternativeDataSourceTypesAndPools() {
        MockEnvironment customType = productionMysqlEnvironment()
                .withProperty("spring.datasource.type", "org.apache.tomcat.jdbc.pool.DataSource");
        assertThatThrownBy(() -> new DatabaseConnectionSecurityEnvironmentPostProcessor()
                .postProcessEnvironment(customType, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("datasource.type");

        MockEnvironment poolOverride = productionMysqlEnvironment()
                .withProperty("spring.datasource.tomcat.url", "jdbc:mysql://db.internal:3306/ams?sslMode=DISABLED");
        assertThatThrownBy(() -> new DatabaseConnectionSecurityEnvironmentPostProcessor()
                .postProcessEnvironment(poolOverride, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("连接池");
    }

    private MockEnvironment productionMysqlEnvironment() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("spring.datasource.url", "jdbc:mysql://db.internal:3306/ams?sslMode=VERIFY_IDENTITY");
        environment.setActiveProfiles("prod");
        return environment;
    }
}
