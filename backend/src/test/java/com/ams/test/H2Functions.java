package com.ams.test;

import java.sql.Timestamp;
import java.time.format.DateTimeFormatter;

public final class H2Functions {

    private H2Functions() {
    }

    public static String dateFormat(Timestamp value, String mysqlPattern) {
        if (value == null || mysqlPattern == null) {
            return null;
        }
        String javaPattern = mysqlPattern
                .replace("%Y", "yyyy")
                .replace("%m", "MM")
                .replace("%d", "dd")
                .replace("%H", "HH")
                .replace("%i", "mm")
                .replace("%s", "ss");
        return value.toLocalDateTime().format(DateTimeFormatter.ofPattern(javaPattern));
    }
}
