import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

class LocationEntityTest {

    @Nested
    @DisplayName("AC-001: DB table is 'location' with columns: id, location_name, location_code, parent_id, sort_order, description, status, create_time, update_time, deleted")
    class Ac001TableStructure {

        @Test
        @DisplayName("Location class maps to table 'location'")
        void shouldMapToLocationTable() {
            TableName annotation = Location.class.getAnnotation(TableName.class);
            assertNotNull(annotation, "Location must have @TableName");
            assertEquals("location", annotation.value());
        }

        @Test
        @DisplayName("Location entity has exactly 10 business fields matching all columns")
        void shouldHaveTenBusinessFields() {
            long userFields = Arrays.stream(Location.class.getDeclaredFields())
                    .filter(f -> !f.getName().contains("$"))
                    .count();
            assertEquals(10, userFields, "Must have exactly 10 fields for: id, location_name, location_code, parent_id, sort_order, description, status, create_time, update_time, deleted");
        }

        @Test
        @DisplayName("Location has 'id' field with @TableId")
        void shouldHaveIdField() throws NoSuchFieldException {
            Field idField = Location.class.getDeclaredField("id");
            assertNotNull(idField.getAnnotation(TableId.class), "id field must have @TableId");
        }

        @Test
        @DisplayName("Location has 'locationCode' field mapping to location_code column")
        void shouldHaveLocationCodeField() throws NoSuchFieldException {
            Field field = Location.class.getDeclaredField("locationCode");
            assertNotNull(field, "Must have locationCode field for location_code column");
        }

        @Test
        @DisplayName("All 10 required fields exist by name")
        void shouldHaveAllRequiredFields() {
            List<String> requiredFields = List.of(
                    "id", "name", "locationCode", "parentId",
                    "sortOrder", "description", "status",
                    "createTime", "updateTime", "deleted"
            );
            List<String> actualFields = Arrays.stream(Location.class.getDeclaredFields())
                    .map(Field::getName)
                    .filter(n -> !n.contains("$"))
                    .collect(Collectors.toList());
            for (String required : requiredFields) {
                assertTrue(actualFields.contains(required),
                        "Missing field: " + required);
            }
        }
    }

    @Nested
    @DisplayName("AC-002: Location entity has @TableName('location'), @TableField('location_name') on name, @TableField('parent_id') on parentId")
    class Ac002AnnotationMapping {

        @Test
        @DisplayName("@TableName('location') on Location class")
        void shouldHaveTableNameLocation() {
            TableName annotation = Location.class.getAnnotation(TableName.class);
            assertNotNull(annotation, "Location class must have @TableName");
            assertEquals("location", annotation.value());
        }

        @Test
        @DisplayName("@TableField('location_name') on name field")
        void nameFieldShouldMapToLocationName() throws NoSuchFieldException {
            Field nameField = Location.class.getDeclaredField("name");
            TableField annotation = nameField.getAnnotation(TableField.class);
            assertNotNull(annotation, "name field must have @TableField");
            assertEquals("location_name", annotation.value());
        }

        @Test
        @DisplayName("@TableField('parent_id') on parentId field")
        void parentIdFieldShouldMapToParentId() throws NoSuchFieldException {
            Field parentIdField = Location.class.getDeclaredField("parentId");
            TableField annotation = parentIdField.getAnnotation(TableField.class);
            assertNotNull(annotation, "parentId field must have @TableField");
            assertEquals("parent_id", annotation.value());
        }
    }

    @Nested
    @DisplayName("AC-005: Module can be imported without error")
    class Ac005Importability {

        @Test
        @DisplayName("Location class can be loaded without ClassNotFoundException")
        void locationClassCanBeLoaded() {
            assertDoesNotThrow(() -> {
                Class<?> clazz = Class.forName("com.ams.entity.Location");
                assertNotNull(clazz);
                assertEquals("com.ams.entity.Location", clazz.getName());
            }, "Location class must be importable without any error");
        }

        @Test
        @DisplayName("Location instance can be created via default constructor")
        void locationInstanceCanBeCreated() {
            assertDoesNotThrow(() -> {
                Location location = Location.class.getDeclaredConstructor().newInstance();
                assertNotNull(location);
            }, "Location must be instantiable without error");
        }
    }
}