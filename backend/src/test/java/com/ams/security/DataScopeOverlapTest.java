package com.ams.security;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DataScopeOverlapTest {

    @Test
    void overlapsDeptCsvShouldMatchCommaSeparatedDepartments() {
        DataScope scope = DataScope.filtered(9L, Set.of(3L, 8L), false);

        assertTrue(scope.overlapsDeptCsv("3,5"));
        assertTrue(scope.overlapsDeptCsv("[8, 9]"));
        assertFalse(scope.overlapsDeptCsv("1,2"));
        assertFalse(scope.overlapsDeptCsv(""));
    }

    @Test
    void allowsShouldAcceptAnyMatchingUser() {
        DataScope scope = DataScope.filtered(9L, Set.of(3L), true);

        assertTrue(scope.allows(4L, 8L, 9L));
        assertFalse(scope.allows(4L, 8L, 7L));
    }
}
