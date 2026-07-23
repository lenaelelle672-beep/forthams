package com.ams.enums;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AssetStatusTest {

    @Test
    void shouldNormalizeKnownAliases() {
        assertEquals(AssetStatus.IN_USE, AssetStatus.fromName("active"));
        assertEquals(AssetStatus.IDLE, AssetStatus.fromName("INACTIVE"));
        assertEquals(AssetStatus.SCRAPPED, AssetStatus.fromName("SCRAP"));
        assertEquals(AssetStatus.PENDING_RETIREMENT, AssetStatus.fromName("retiring"));
        assertEquals(AssetStatus.IN_USE, AssetStatus.fromName("normal"));
        assertEquals(AssetStatus.PENDING_RETIREMENT, AssetStatus.fromName("PENDING_SCRAP"));
        assertEquals(AssetStatus.RETIRED, AssetStatus.fromName("retirement"));
    }

    @Test
    void terminalStatusesShouldNotLeaveTerminalState() {
        assertFalse(AssetStatus.RETIRED.canTransitionTo(AssetStatus.IN_USE));
        assertFalse(AssetStatus.SCRAPPED.canTransitionTo(AssetStatus.IDLE));
        // 终端状态自转换也不允许（防止通过自转换修改终态资产的其他字段）
        assertFalse(AssetStatus.RETIRED.canTransitionTo(AssetStatus.RETIRED));
    }
}
