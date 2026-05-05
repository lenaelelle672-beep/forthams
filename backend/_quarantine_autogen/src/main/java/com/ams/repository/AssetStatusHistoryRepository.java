package com.ams.repository;

import com.ams.entity.AssetStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Repository for accessing asset status history records.
 * Supports persistence of status change events as required by the asset retirement flow.
 */
@Repository
public interface AssetStatusHistoryRepository extends JpaRepository<AssetStatusHistory, Long> {

}