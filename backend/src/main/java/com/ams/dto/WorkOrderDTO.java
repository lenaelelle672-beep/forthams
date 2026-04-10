import lombok.Data;

@Data
public class WorkOrderDTO {
    private Long id; // Auto-Gen

    private String status; // DRAFT, PENDING, APPROVED, EXECUTING, CLOSED
}
