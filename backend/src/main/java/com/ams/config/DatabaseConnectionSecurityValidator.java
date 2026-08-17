package com.ams.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.EnumerablePropertySource;
import org.springframework.core.env.Environment;
import org.springframework.core.env.PropertySource;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** 在建立业务连接前拒绝不满足发布策略的 MySQL 连接配置。 */
@Component
public class DatabaseConnectionSecurityValidator {

    private static final Set<String> NON_PRODUCTION_PROFILES = Set.of("dev", "development", "local", "test");
    private static final String DATASOURCE_JNDI_NAME = "springdatasourcejndiname";
    private static final String DATASOURCE_TYPE = "springdatasourcetype";
    private static final String DATASOURCE_URL = "springdatasourceurl";
    private static final String HIKARI_JDBC_URL = "springdatasourcehikarijdbcurl";
    private static final String HIKARI_DATA_SOURCE_CLASS_NAME = "springdatasourcehikaridatasourceclassname";
    private static final String HIKARI_DATA_SOURCE_JNDI_NAME = "springdatasourcehikaridatasourcejndiname";
    private static final String HIKARI_DATA_SOURCE = "springdatasourcehikaridatasource";
    private static final String HIKARI_DATA_SOURCE_PROPERTIES = "springdatasourcehikaridatasourceproperties";

    private final Environment environment;
    private final String jdbcUrl;
    private final boolean requireTls;
    private final boolean allowInsecureLocalDevelopment;
    private final Map<String, ?> hikariDataSourceProperties;
    private final String hikariJdbcUrl;
    private final String hikariDataSourceClassName;
    private final String hikariDataSourceJndiName;

    @Autowired
    public DatabaseConnectionSecurityValidator(Environment environment) {
        this(environment,
                firstProperty(environment, DATASOURCE_URL, "spring.datasource.url"),
                environment.getProperty("app.database.require-tls", Boolean.class, true),
                environment.getProperty("app.database.allow-insecure-local-dev", Boolean.class, false),
                hikariDataSourceProperties(environment),
                firstProperty(environment, HIKARI_JDBC_URL, "spring.datasource.hikari.jdbc-url"),
                firstProperty(environment, HIKARI_DATA_SOURCE_CLASS_NAME, "spring.datasource.hikari.data-source-class-name"),
                firstProperty(environment, HIKARI_DATA_SOURCE_JNDI_NAME, "spring.datasource.hikari.data-source-jndi-name"));
    }

    DatabaseConnectionSecurityValidator(String jdbcUrl, boolean requireTls, boolean allowInsecureLocalDevelopment) {
        this(null, jdbcUrl, requireTls, allowInsecureLocalDevelopment, Map.of(), null, null, null);
    }

    DatabaseConnectionSecurityValidator(String jdbcUrl, boolean requireTls, boolean allowInsecureLocalDevelopment,
                                         Map<String, ?> hikariDataSourceProperties, String hikariJdbcUrl) {
        this(null, jdbcUrl, requireTls, allowInsecureLocalDevelopment, hikariDataSourceProperties, hikariJdbcUrl, null, null);
    }

    DatabaseConnectionSecurityValidator(String jdbcUrl, boolean requireTls, boolean allowInsecureLocalDevelopment,
                                         Map<String, ?> hikariDataSourceProperties, String hikariJdbcUrl,
                                         String hikariDataSourceClassName, String hikariDataSourceJndiName) {
        this(null, jdbcUrl, requireTls, allowInsecureLocalDevelopment, hikariDataSourceProperties, hikariJdbcUrl,
                hikariDataSourceClassName, hikariDataSourceJndiName);
    }

    private DatabaseConnectionSecurityValidator(Environment environment, String jdbcUrl, boolean requireTls,
                                                boolean allowInsecureLocalDevelopment,
                                                Map<String, ?> hikariDataSourceProperties, String hikariJdbcUrl,
                                                String hikariDataSourceClassName, String hikariDataSourceJndiName) {
        this.environment = environment;
        this.jdbcUrl = jdbcUrl;
        this.requireTls = requireTls;
        this.allowInsecureLocalDevelopment = allowInsecureLocalDevelopment;
        this.hikariDataSourceProperties = hikariDataSourceProperties == null ? Map.of() : hikariDataSourceProperties;
        this.hikariJdbcUrl = hikariJdbcUrl;
        this.hikariDataSourceClassName = hikariDataSourceClassName;
        this.hikariDataSourceJndiName = hikariDataSourceJndiName;
    }

    @PostConstruct
    void validate() {
        if (environment != null) {
            validateEnvironmentConfiguration(environment);
            return;
        }
        validateConfiguration(jdbcUrl, requireTls, allowInsecureLocalDevelopment,
                hikariDataSourceProperties, hikariJdbcUrl, hikariDataSourceClassName, hikariDataSourceJndiName);
    }

    static void validateEnvironmentConfiguration(Environment environment) {
        String jdbcUrl = firstProperty(environment, DATASOURCE_URL, "spring.datasource.url");
        if (isProductionLike(environment)) {
            rejectJndiDataSource(environment);
            rejectDataSourceBypasses(environment, jdbcUrl);
        }
        validateConfiguration(jdbcUrl,
                environment.getProperty("app.database.require-tls", Boolean.class, true),
                environment.getProperty("app.database.allow-insecure-local-dev", Boolean.class, false),
                hikariDataSourceProperties(environment),
                firstProperty(environment, HIKARI_JDBC_URL, "spring.datasource.hikari.jdbc-url"),
                firstProperty(environment, HIKARI_DATA_SOURCE_CLASS_NAME,
                        "spring.datasource.hikari.data-source-class-name"),
                firstProperty(environment, HIKARI_DATA_SOURCE_JNDI_NAME,
                        "spring.datasource.hikari.data-source-jndi-name"));
    }

    static void validateConfiguration(String jdbcUrl, boolean requireTls, boolean allowInsecureLocalDevelopment) {
        validateConfiguration(jdbcUrl, requireTls, allowInsecureLocalDevelopment, Map.of(), null);
    }

    static void validateConfiguration(String jdbcUrl, boolean requireTls, boolean allowInsecureLocalDevelopment,
                                      Map<String, ?> hikariDataSourceProperties, String hikariJdbcUrl) {
        validateConfiguration(jdbcUrl, requireTls, allowInsecureLocalDevelopment,
                hikariDataSourceProperties, hikariJdbcUrl, null, null);
    }

    static void validateConfiguration(String jdbcUrl, boolean requireTls, boolean allowInsecureLocalDevelopment,
                                      Map<String, ?> hikariDataSourceProperties, String hikariJdbcUrl,
                                      String hikariDataSourceClassName, String hikariDataSourceJndiName) {
        if (jdbcUrl == null || jdbcUrl.isBlank()) {
            throw new IllegalStateException("数据库连接地址必须显式配置");
        }
        if (hikariJdbcUrl != null && !hikariJdbcUrl.isBlank()
                && !jdbcUrl.equals(hikariJdbcUrl)) {
            throw new IllegalStateException("不允许 Hikari jdbc-url 覆盖受控数据库连接地址");
        }
        if (!isMysqlUrl(jdbcUrl)) {
            return;
        }
        if ((hikariDataSourceClassName != null && !hikariDataSourceClassName.isBlank())
                || (hikariDataSourceJndiName != null && !hikariDataSourceJndiName.isBlank())) {
            throw new IllegalStateException("生产 MySQL 连接不允许 Hikari data-source-class-name 或 data-source-jndi-name 绕过受控 JDBC URL");
        }
        validateHikariDataSourceProperties(hikariDataSourceProperties);
        if (requireTls) {
            if (!usesVerifiedIdentityTls(jdbcUrl)) {
                throw new IllegalStateException("生产 MySQL 连接必须使用 sslMode=VERIFY_IDENTITY；本地例外须显式设置受控开关");
            }
            return;
        }
        if (!allowInsecureLocalDevelopment || !isLoopbackMysqlUrl(jdbcUrl)) {
            throw new IllegalStateException("仅允许显式受控的 loopback 本地开发禁用 MySQL TLS");
        }
    }

    private static boolean isMysqlUrl(String url) {
        return url != null && url.trim().toLowerCase(Locale.ROOT).startsWith("jdbc:mysql:");
    }

    private static boolean isLoopbackMysqlUrl(String url) {
        try {
            String mysqlUrl = url.trim().substring("jdbc:".length());
            String host = URI.create(mysqlUrl).getHost();
            return "localhost".equalsIgnoreCase(host)
                    || "127.0.0.1".equals(host)
                    || "::1".equals(host)
                    || "[::1]".equals(host);
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private static boolean usesVerifiedIdentityTls(String url) {
        if (!url.trim().toLowerCase(Locale.ROOT).startsWith("jdbc:mysql://")) {
            return false;
        }
        Map<String, String> parameters = queryParameters(url);
        return parameters != null && "verify_identity".equals(parameters.get("sslmode"));
    }

    private static Map<String, String> queryParameters(String url) {
        int queryStart = url.indexOf('?');
        if (queryStart < 0) {
            return Map.of();
        }
        if (queryStart == url.length() - 1 || url.indexOf('?', queryStart + 1) >= 0
                || url.indexOf('#', queryStart) >= 0 || url.indexOf(';') >= 0) {
            return null;
        }
        String query = url.substring(queryStart + 1);

        Map<String, String> parameters = new LinkedHashMap<>();
        Set<String> normalizedKeys = new HashSet<>();
        for (String parameter : query.split("&", -1)) {
            int equalsIndex = parameter.indexOf('=');
            if (equalsIndex <= 0 || equalsIndex != parameter.lastIndexOf('=')) {
                return null;
            }
            String key;
            String value;
            try {
                key = URLDecoder.decode(parameter.substring(0, equalsIndex), StandardCharsets.UTF_8)
                        .trim().toLowerCase(Locale.ROOT);
                value = URLDecoder.decode(parameter.substring(equalsIndex + 1), StandardCharsets.UTF_8)
                        .trim().toLowerCase(Locale.ROOT);
            } catch (IllegalArgumentException exception) {
                return null;
            }
            if (key.isEmpty() || !normalizedKeys.add(key) || !"sslmode".equals(key)
                    || !"verify_identity".equals(value)) {
                return null;
            }
            parameters.put(key, value);
        }
        return parameters;
    }

    static Map<String, Object> hikariDataSourceProperties(Environment environment) {
        try {
            return Binder.get(environment)
                    .bind("spring.datasource.hikari.data-source-properties", Bindable.mapOf(String.class, Object.class))
                    .orElse(Map.of());
        } catch (RuntimeException exception) {
            throw new IllegalStateException("Hikari data-source-properties 配置不合法", exception);
        }
    }

    private static void validateHikariDataSourceProperties(Map<String, ?> hikariDataSourceProperties) {
        if (hikariDataSourceProperties == null || hikariDataSourceProperties.isEmpty()) {
            return;
        }
        Set<String> normalizedKeys = new HashSet<>();
        for (Map.Entry<String, ?> entry : hikariDataSourceProperties.entrySet()) {
            String key = entry.getKey() == null ? "" : entry.getKey().trim().toLowerCase(Locale.ROOT);
            if (key.isEmpty() || !normalizedKeys.add(key) || entry.getValue() == null) {
                throw new IllegalStateException("Hikari data-source-properties 配置不合法");
            }
        }
        throw new IllegalStateException("生产 MySQL 连接不允许 Hikari data-source-properties；"
                + "必须仅通过受控 JDBC URL 设置 sslMode=VERIFY_IDENTITY");
    }

    private static void rejectJndiDataSource(Environment environment) {
        if (hasNonBlankProperty(environment, DATASOURCE_JNDI_NAME,
                "spring.datasource.jndi-name", "spring.datasource.jndiName", "SPRING_DATASOURCE_JNDI_NAME")) {
            throw new IllegalStateException("生产环境禁止配置 spring.datasource.jndi-name");
        }
    }

    private static void rejectDataSourceBypasses(Environment environment, String jdbcUrl) {
        if (!isMysqlUrl(jdbcUrl)) {
            return;
        }
        String dataSourceType = firstProperty(environment, DATASOURCE_TYPE, "spring.datasource.type");
        if (dataSourceType != null && !dataSourceType.isBlank()
                && !"com.zaxxer.hikari.HikariDataSource".equals(dataSourceType.trim())) {
            throw new IllegalStateException("生产 MySQL 连接仅允许受控 Hikari 数据源，禁止 spring.datasource.type 切换连接池");
        }
        if (hasNonBlankPropertyWithPrefix(environment, "springdatasourcetomcat")
                || hasNonBlankPropertyWithPrefix(environment, "springdatasourcedbcp2")
                || hasNonBlankPropertyWithPrefix(environment, "springdatasourceoracleucp")
                || hasNonBlankPropertyWithPrefix(environment, "springdatasourceucp")) {
            throw new IllegalStateException("生产 MySQL 连接不允许替代连接池配置绕过受控 JDBC URL");
        }
        if (hasNonBlankProperty(environment, HIKARI_DATA_SOURCE,
                "spring.datasource.hikari.data-source")
                || hasNonBlankPropertyWithPrefix(environment, HIKARI_DATA_SOURCE_PROPERTIES)) {
            throw new IllegalStateException("生产 MySQL 连接不允许 Hikari data-source 或 data-source-properties 绕过受控 JDBC URL");
        }
    }

    private static boolean isProductionLike(Environment environment) {
        String[] activeProfiles = environment.getActiveProfiles();
        if (activeProfiles.length == 0) {
            activeProfiles = environment.getDefaultProfiles();
        }
        boolean explicitlyNonProduction = false;
        for (String profile : activeProfiles) {
            if (profile == null || profile.isBlank()) {
                continue;
            }
            String normalized = profile.trim().toLowerCase(Locale.ROOT);
            if ("prod".equals(normalized) || "production".equals(normalized)) {
                return true;
            }
            if (NON_PRODUCTION_PROFILES.contains(normalized)) {
                explicitlyNonProduction = true;
            } else {
                return true;
            }
        }
        return !explicitlyNonProduction;
    }

    private static String firstProperty(Environment environment, String canonicalName, String... directNames) {
        for (String directName : directNames) {
            String directValue = environment.getProperty(directName);
            if (directValue != null) {
                return directValue;
            }
        }
        if (environment instanceof ConfigurableEnvironment configurableEnvironment) {
            for (PropertySource<?> propertySource : configurableEnvironment.getPropertySources()) {
                if (!(propertySource instanceof EnumerablePropertySource<?> enumerablePropertySource)) {
                    continue;
                }
                for (String propertyName : enumerablePropertySource.getPropertyNames()) {
                    if (canonicalName.equals(canonicalizePropertyName(propertyName))) {
                        Object value = enumerablePropertySource.getProperty(propertyName);
                        if (value != null) {
                            return String.valueOf(value);
                        }
                    }
                }
            }
        }
        return null;
    }

    private static boolean hasNonBlankProperty(Environment environment, String canonicalName, String... directNames) {
        String value = firstProperty(environment, canonicalName, directNames);
        return value != null && !value.isBlank();
    }

    private static boolean hasNonBlankPropertyWithPrefix(Environment environment, String canonicalPrefix) {
        if (!(environment instanceof ConfigurableEnvironment configurableEnvironment)) {
            return false;
        }
        for (PropertySource<?> propertySource : configurableEnvironment.getPropertySources()) {
            if (!(propertySource instanceof EnumerablePropertySource<?> enumerablePropertySource)) {
                continue;
            }
            for (String propertyName : enumerablePropertySource.getPropertyNames()) {
                if (canonicalizePropertyName(propertyName).startsWith(canonicalPrefix)) {
                    Object value = enumerablePropertySource.getProperty(propertyName);
                    if (value != null && !String.valueOf(value).isBlank()) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private static String canonicalizePropertyName(String propertyName) {
        if (propertyName == null) {
            return "";
        }
        StringBuilder normalized = new StringBuilder(propertyName.length());
        propertyName.codePoints()
                .filter(Character::isLetterOrDigit)
                .forEach(codePoint -> normalized.appendCodePoint(Character.toLowerCase(codePoint)));
        return normalized.toString();
    }
}
