package com.ams.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class MigrationFileNamingTest {

    private static final Pattern VERSIONED_SQL = Pattern.compile("^(V\\d+(?:_\\d+)?)__.+\\.sql$");

    @Test
    void migrationVersionsShouldBeUniqueWithinEachDirectory() throws IOException {
        assertUniqueVersions(Path.of("src/main/resources/migration"));
        assertUniqueVersions(Path.of("src/main/resources/db/migration"));
    }

    private static void assertUniqueVersions(Path directory) throws IOException {
        if (!Files.isDirectory(directory)) {
            return;
        }

        Map<String, List<String>> filesByVersion;
        try (var files = Files.list(directory)) {
            filesByVersion = files
                    .filter(Files::isRegularFile)
                    .map(path -> path.getFileName().toString())
                    .filter(name -> versionOf(name) != null)
                    .collect(Collectors.groupingBy(
                            MigrationFileNamingTest::versionOf,
                            Collectors.toList()));
        }

        Map<String, List<String>> duplicates = filesByVersion.entrySet().stream()
                .filter(entry -> entry.getValue().size() > 1)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

        assertThat(duplicates)
                .as("Duplicate migration versions in %s", directory)
                .isEmpty();
    }

    private static String versionOf(String fileName) {
        Matcher matcher = VERSIONED_SQL.matcher(fileName);
        return matcher.matches() ? matcher.group(1) : null;
    }
}
