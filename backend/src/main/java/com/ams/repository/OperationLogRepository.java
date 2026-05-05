package com.ams.repository;

/**
 * Compatibility repository marker for operation log acceptance targets.
 *
 * <p>The current persistence layer uses MyBatis-Plus mappers; this marker keeps
 * legacy repository-based integrations loadable without introducing JPA.</p>
 */
public interface OperationLogRepository {
}
