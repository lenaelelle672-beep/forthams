package com.ams.entity;

import java.time.Instant;
import java.util.Objects;
import javax.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * GeneralAuditEntry captures a low-level, append-only audit record for system-wide observability.
 * It participates in a hash-chain to guarantee tamper-evidence across the audit log.
 * This entity is intentionally generic to accommodate audit events from any bounded context.
 */
@Entity
@Table(name = "general_audit_entry")
@JsonIgnoreProperties(ignoreUnknown = true)
public class GeneralAuditEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * The aggregate identifier being audited (e.g., assetId, userId, workOrderId).
     * Not nullable to ensure traceability.
     */
    @Column(nullable = false)
    private String aggregateId;

    /**
     * The type of the aggregate (e.g., "ASSET", "USER", "WORK_ORDER").
     * Helps with indexing and UI rendering.
     */
    @Column(nullable = false, length = 64)
    private String aggregateType;

    /**
     * The event/action that occurred (e.g., "STATE_TRANSITION", "VALUE_UPDATE").
     */
    @Column(nullable = false, length = 128)
    private String eventType;

    /**
     * A JSON payload containing the before/after snapshots relevant to this event.
     * Stored as text for portability and schema flexibility.
     */
    @Column(columnDefinition = "TEXT", nullable = false)
    private String payload;

    /**
     * The previous entry’s hash in the chain; null for the first entry.
     */
    @Column(length = 66)
    private String previousHash;

    /**
     * The hash of this entry computed over (previousHash + serialized payload + metadata).
     * Used to verify chain integrity.
     */
    @Column(length = 66, nullable = false, unique = true)
    private String entryHash;

    /**
     * Human-readable description for audit dashboards.
     */
    @Column(length = 512)
    private String description;

    /**
     * The actor (service principal or user) that triggered this audit event.
     */
    @Column(length = 256)
    private String actor;

    /**
     * UTC timestamp when the audit entry was created.
     */
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    /**
     * UTC timestamp of the last modification (primarily for soft-audit updates).
     */
    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    /**
     * Version field for optimistic locking.
     */
    @Version
    private Long version;

    // ---- constructors ----

    public GeneralAuditEntry() {
        // default constructor required by JPA
    }

    public GeneralAuditEntry(
            String aggregateId,
            String aggregateType,
            String eventType,
            String payload,
            String previousHash,
            String entryHash,
            String description,
            String actor) {
        this.aggregateId = Objects.requireNonNull(aggregateId, "aggregateId is required");
        this.aggregateType = Objects.requireNonNull(aggregateType, "aggregateType is required");
        this.eventType = Objects.requireNonNull(eventType, "eventType is required");
        this.payload = Objects.requireNonNull(payload, "payload is required");
        this.previousHash = previousHash;
        this.entryHash = Objects.requireNonNull(entryHash, "entryHash is required");
        this.description = description;
        this.actor = Objects.requireNonNull(actor, "actor is required");
    }

    // ---- getters / setters ----

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getAggregateId() {
        return aggregateId;
    }

    public void setAggregateId(String aggregateId) {
        this.aggregateId = aggregateId;
    }

    public String getAggregateType() {
        return aggregateType;
    }

    public void setAggregateType(String aggregateType) {
        this.aggregateType = aggregateType;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }

    public String getPreviousHash() {
        return previousHash;
    }

    public void setPreviousHash(String previousHash) {
        this.previousHash = previousHash;
    }

    public String getEntryHash() {
        return entryHash;
    }

    public void setEntryHash(String entryHash) {
        this.entryHash = entryHash;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getActor() {
        return actor;
    }

    public void setActor(String actor) {
        this.actor = actor;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    // ---- business helpers ----

    /**
     * Returns true if this entry correctly chains to the given predecessor.
     */
    public boolean chainsFrom(GeneralAuditEntry predecessor) {
        if (predecessor == null) {
            return this.previousHash == null;
        }
        return Objects.equals(this.previousHash, predecessor.getEntryHash());
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        GeneralAuditEntry that = (GeneralAuditEntry) o;
        return Objects.equals(id, that.id) &&
                Objects.equals(aggregateId, that.aggregateId) &&
                Objects.equals(aggregateType, that.aggregateType) &&
                Objects.equals(eventType, that.eventType) &&
                Objects.equals(payload, that.payload) &&
                Objects.equals(previousHash, that.previousHash) &&
                Objects.equals(entryHash, that.entryHash) &&
                Objects.equals(description, that.description) &&
                Objects.equals(actor, that.actor) &&
                Objects.equals(createdAt, that.createdAt) &&
                Objects.equals(updatedAt, that.updatedAt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, aggregateId, aggregateType, eventType, payload, previousHash, entryHash, description, actor, createdAt, updatedAt, version);
    }

    @Override
    public String toString() {
        return "GeneralAuditEntry{" +
                "id=" + id +
                ", aggregateId='" + aggregateId + '\'' +
                ", aggregateType='" + aggregateType + '\'' +
                ", eventType='" + eventType + '\'' +
                ", payload='" + payload + '\'' +
                ", previousHash='" + previousHash + '\'' +
                ", entryHash='" + entryHash + '\'' +
                ", description='" + description + '\'' +
                ", actor='" + actor + '\'' +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                ", version=" + version +
                '}';
    }
}