package com.ams.mapper;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Location mapper/schema contract")
class LocationMapperSchemaContractTest {

    @Test
    @DisplayName("mapper should use the current location schema column names")
    void mapperUsesCurrentLocationSchemaColumns() throws Exception {
        String mapper = Files.readString(Path.of("src/main/java/com/ams/mapper/LocationMapper.java"));
        String schema = Files.readString(Path.of("src/main/resources/schema.sql"));

        assertThat(schema).contains("CREATE TABLE IF NOT EXISTS location");
        assertThat(schema).contains("name VARCHAR(256) NOT NULL");
        assertThat(schema).contains("location_code VARCHAR(64) UNIQUE");
        assertThat(schema).doesNotContain("location_name");
        assertThat(mapper).doesNotContain("location_name");
        assertThat(mapper).contains("name, location_code");
    }
}
