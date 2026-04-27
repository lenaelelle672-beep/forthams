import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ModuleImportTest {

    @Test
    @DisplayName("AC-004: CreateTaskModal 可被正常 import 不抛出异常")
    void testCreateTaskModalImport() {
        assertDoesNotThrow(() ->
            Class.forName("com.example.inventory.CreateTaskModal")
        );
    }

    @Test
    @DisplayName("AC-004: ScopeSelector 可被正常 import 不抛出异常")
    void testScopeSelectorImport() {
        assertDoesNotThrow(() ->
            Class.forName("com.example.inventory.ScopeSelector")
        );
    }

    @Test
    @DisplayName("AC-004: InventoryStore 可被正常 import 不抛出异常")
    void testInventoryStoreImport() {
        assertDoesNotThrow(() ->
            Class.forName("com.example.inventory.InventoryStore")
        );
    }

    @Test
    @DisplayName("AC-004: InventoryApi 可被正常 import 不抛出异常")
    void testInventoryApiImport() {
        assertDoesNotThrow(() ->
            Class.forName("com.example.inventory.InventoryApi")
        );
    }

    @Test
    @DisplayName("AC-004: InventoryTypes 可被正常 import 不抛出异常")
    void testInventoryTypesImport() {
        assertDoesNotThrow(() ->
            Class.forName("com.example.inventory.InventoryTypes")
        );
    }
}