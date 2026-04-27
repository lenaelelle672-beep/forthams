package com.ams.controller;

import com.ams.common.Result;
import com.ams.context.TenantContext;
import com.ams.dto.AssetCreateDTO;
import com.ams.dto.AssetQueryDTO;
import com.ams.dto.AssetUpdateDTO;
import com.ams.entity.Asset;
import com.ams.service.AssetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for Asset management operations.
 *
 * <p>Multi-tenancy integration: This controller does NOT explicitly handle
 * tenant filtering in query logic. Data isolation is achieved transparently
 * through the following infrastructure layers:
 * <ul>
 *   <li>Hibernate {@code @Filter} on the Asset entity automatically appends
 *       {@code WHERE tenant_id = :tenantId} to all generated SQL.</li>
 *   <li>A Hibernate session-level interceptor (or AOP aspect) enables the
 *       filter using the tenant_id resolved from {@link TenantContext}.</li>
 *   <li>Write operations auto-inject tenant_id via JPA {@code @PrePersist}
 *       callback or Hibernate interceptor before persistence.</li>
 * </ul>
 *
 * <p>Acceptance test mapping:
 * <ul>
 *   <li>ATB-TC-01: Any endpoint verifies JWT parsing → TenantContext injection
 *       (tenant_id logged at DEBUG level).</li>
 *   <li>ATB-TC-03: {@code GET /api/assets} verifies read isolation — only
 *       records belonging to the JWT's tenant are returned.</li>
 *   <li>ATB-TC-04: {@code POST /api/assets} verifies auto-injection of
 *       tenant_id on write — request body must NOT contain tenant_id.</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/assets")
@RequiredArgsConstructor
public class AssetController {

    private final AssetService assetService;

    /**
     * Retrieve a paginated list of assets for the current tenant.
     *
     * <p>ATB-TC-03 target endpoint: the response list must contain only
     * records where {@code tenant_id} matches the tenant extracted from
     * the JWT token. Hibernate {@code @Filter} ensures SQL-level automatic
     * filtering via {@code WHERE tenant_id = :tenantId}.
     *
     * @param queryDTO optional query criteria (name, category, status, etc.)
     * @param pageable pagination parameters (page, size, sort)
     * @return paginated result of assets belonging to the current tenant
     */
    @GetMapping
    public ResponseEntity<Result<Page<Asset>>> listAssets(
            AssetQueryDTO queryDTO,
            Pageable pageable) {
        log.debug("Listing assets for tenant: {}", TenantContext.getTenantId());
        Page<Asset> page = assetService.findAll(queryDTO, pageable);
        return ResponseEntity.ok(Result.success(page));
    }

    /**
     * Retrieve a single asset by its identifier.
     *
     * <p>The Hibernate tenant filter ensures that if the asset does not
     * belong to the current tenant, the query returns an empty result
     * set (effectively a 404), preventing cross-tenant data leakage.
     *
     * @param id the asset identifier
     * @return the asset if found and belongs to current tenant; 404 otherwise
     */
    @GetMapping("/{id}")
    public ResponseEntity<Result<Asset>> getAssetById(@PathVariable Long id) {
        log.debug("Fetching asset {} for tenant: {}", id, TenantContext.getTenantId());
        return assetService.findById(id)
                .map(asset -> ResponseEntity.ok(Result.success(asset)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Result.fail("Asset not found")));
    }

    /**
     * Create a new asset.
     *
     * <p>ATB-TC-04 target endpoint: the request body does NOT include
     * {@code tenant_id}. The tenant_id is automatically injected from
     * {@link TenantContext} via JPA lifecycle callbacks ({@code @PrePersist})
     * or a Hibernate interceptor before the entity is persisted.
     *
     * @param dto the asset creation data (must not contain tenant_id)
     * @return the created asset with HTTP 201 status
     */
    @PostMapping
    public ResponseEntity<Result<Asset>> createAsset(
            @Valid @RequestBody AssetCreateDTO dto) {
        log.debug("Creating asset for tenant: {}", TenantContext.getTenantId());
        Asset created = assetService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Result.success(created));
    }

    /**
     * Update an existing asset.
     *
     * <p>The Hibernate tenant filter ensures cross-tenant update is
     * impossible: if the asset belongs to a different tenant, the
     * lookup query returns empty and this method responds with 404.
     *
     * @param id  the asset identifier
     * @param dto the asset update data
     * @return the updated asset, or 404 if not found or belongs to another tenant
     */
    @PutMapping("/{id}")
    public ResponseEntity<Result<Asset>> updateAsset(
            @PathVariable Long id,
            @Valid @RequestBody AssetUpdateDTO dto) {
        log.debug("Updating asset {} for tenant: {}", id, TenantContext.getTenantId());
        return assetService.update(id, dto)
                .map(asset -> ResponseEntity.ok(Result.success(asset)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Result.fail("Asset not found")));
    }

    /**
     * Delete an asset by its identifier.
     *
     * <p>Cross-tenant deletion is prevented by the Hibernate tenant filter:
     * the lookup query includes {@code WHERE tenant_id = :tenantId},
     * so assets belonging to other tenants are invisible and cannot be deleted.
     *
     * @param id the asset identifier
     * @return 204 No Content on success; 404 if not found or wrong tenant
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Result<Void>> deleteAsset(@PathVariable Long id) {
        log.debug("Deleting asset {} for tenant: {}", id, TenantContext.getTenantId());
        boolean deleted = assetService.deleteById(id);
        if (deleted) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Result.fail("Asset not found"));
    }
}