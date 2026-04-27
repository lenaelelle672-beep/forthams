import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class InventoryModuleImportTest {

    @Test
    void ac004_moduleImportShouldNotThrowError() {
        assertDoesNotThrow(
            () -> {
                Class<?> cls = Class.forName(
                    "com.example.inventory.CreateTaskService"
                );
                assertNotNull(cls, "Imported class should not be null");
            },
            "变更后的模块应可被正常 import，不应抛出 ClassNotFoundException"
        );
    }
}