"""
Tenant Isolation Service - Layer 3: Isolation Validation Layer

This module implements tenant isolation validation logic as defined in
SWARM-2025-Q2-P1-004 Phase 1 specification.

Security Boundaries:
- C-001: Request chain must pass through TenantContext binding
- C-002: No bypass of tenant isolation, no hardcoded tenant_id
- C-003: Cross-tenant access validation enforced
- C-004: Exception handling per boundary rules (400/403/500)
- C-005: Performance constraint < 1ms

Usage:
    from services.tenant_isolation import TenantIsolationService
    
    service = TenantIsolationService()
    service.validate_resource_access(resource_tenant_id)
"""

from typing import Optional, Any, Dict, List, Type
import logging
from dataclasses import dataclass, field
from enum import Enum

from core.tenant_context import TenantContext, get_current_tenant_id
from core.exceptions import (
    TenantContextRequiredError,
    TenantAccessDeniedError,
)

logger = logging.getLogger(__name__)


class AccessDecision(Enum):
    """Access control decision outcomes."""
    ALLOWED = "allowed"
    DENIED_CROSS_TENANT = "denied_cross_tenant"
    DENIED_CONTEXT_MISSING = "denied_context_missing"
    DENIED_RESOURCE_NOT_FOUND = "denied_resource_not_found"


@dataclass
class IsolationCheckResult:
    """
    Result of tenant isolation validation check.
    
    Attributes:
        decision: The access decision outcome
        current_tenant_id: Tenant ID from current context
        resource_tenant_id: Tenant ID of the target resource
        reason: Human-readable reason for denial (if applicable)
        metadata: Additional context for audit logging
    """
    decision: AccessDecision
    current_tenant_id: Optional[str] = None
    resource_tenant_id: Optional[str] = None
    reason: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def is_allowed(self) -> bool:
        """Check if access is allowed."""
        return self.decision == AccessDecision.ALLOWED
    
    @property
    def is_denied(self) -> bool:
        """Check if access is denied."""
        return not self.is_allowed


class TenantIsolationService:
    """
    Tenant isolation validation service.
    
    This service provides methods to validate tenant boundaries and ensure
    that cross-tenant data access is prevented. It operates on top of
    the TenantContext established during request processing.
    
    Performance Constraint C-005:
        - All validation methods must complete in < 1ms
        - No database queries in hot path
        - Minimal object allocation
    
    Example:
        service = TenantIsolationService()
        
        # Validate direct resource access
        result = service.validate_resource_access(
            resource_tenant_id="tenant-xyz"
        )
        if not result.is_allowed:
            raise TenantAccessDeniedError(result.reason)
        
        # Validate model instance access
        result = service.validate_model_access(my_model_instance)
        if not result.is_allowed:
            raise TenantAccessDeniedError(result.reason)
    """
    
    def __init__(
        self,
        enable_audit_logging: bool = True,
        strict_mode: bool = True,
    ) -> None:
        """
        Initialize the tenant isolation service.
        
        Args:
            enable_audit_logging: Whether to log cross-tenant access attempts.
                                  Security requirement: must log all denials.
            strict_mode: If True, deny access when tenant_id mismatch detected.
                         If False, log but allow (for debugging only).
        """
        self._enable_audit_logging = enable_audit_logging
        self._strict_mode = strict_mode
        self._audit_logger = logging.getLogger("security.tenant_isolation")
    
    def get_current_tenant_id(self) -> Optional[str]:
        """
        Get the current tenant ID from TenantContext.
        
        Returns:
            The current tenant_id if set, None otherwise.
        
        Note:
            This method delegates to TenantContext.get_current() which
            uses contextvars for thread/async safety (C-005 compliance).
        """
        return get_current_tenant_id()
    
    def validate_context_exists(self) -> None:
        """
        Validate that TenantContext is properly set for the current request.
        
        Raises:
            TenantContextRequiredError: If tenant context is not set.
        
        This is the primary guard for constraint C-001 ensuring no data
        access occurs without proper tenant context binding.
        """
        tenant_id = self.get_current_tenant_id()
        if tenant_id is None:
            logger.error(
                "TenantContextRequiredError: Data access attempted "
                "without tenant context. This violates constraint C-001."
            )
            raise TenantContextRequiredError(
                "Tenant context is required for data access. "
                "Ensure JWT middleware has properly bound tenant_id."
            )
    
    def validate_resource_access(
        self,
        resource_tenant_id: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> IsolationCheckResult:
        """
        Validate access to a resource based on tenant boundaries.
        
        This method implements the core cross-tenant access prevention logic.
        Per constraint C-003, it validates that request tenant_id matches
        resource tenant_id.
        
        Args:
            resource_tenant_id: The tenant_id of the target resource.
            resource_type: Optional type of resource for audit logging.
            resource_id: Optional ID of resource for audit logging.
        
        Returns:
            IsolationCheckResult with decision and metadata.
        
        Raises:
            TenantAccessDeniedError: In strict_mode when tenant mismatch detected.
        
        Performance:
            Target: < 1ms (C-005 constraint)
            Implementation: No DB queries, minimal object allocation
        """
        current_tenant_id = self.get_current_tenant_id()
        
        # Fast path: direct comparison without exceptions
        if current_tenant_id == resource_tenant_id:
            return IsolationCheckResult(
                decision=AccessDecision.ALLOWED,
                current_tenant_id=current_tenant_id,
                resource_tenant_id=resource_tenant_id,
                metadata={
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                },
            )
        
        # Tenant mismatch detected
        result = IsolationCheckResult(
            decision=AccessDecision.DENIED_CROSS_TENANT,
            current_tenant_id=current_tenant_id,
            resource_tenant_id=resource_tenant_id,
            reason=(
                f"Cross-tenant access denied: current tenant '{current_tenant_id}' "
                f"cannot access resource in tenant '{resource_tenant_id}'"
            ),
            metadata={
                "resource_type": resource_type,
                "resource_id": resource_id,
                "attempted_access": True,
            },
        )
        
        self._log_cross_tenant_attempt(result)
        
        if self._strict_mode:
            raise TenantAccessDeniedError(result.reason)
        
        return result
    
    def validate_model_access(
        self,
        model: Any,
        tenant_id_field: str = "tenant_id",
    ) -> IsolationCheckResult:
        """
        Validate access to a model instance based on tenant isolation.
        
        Extracts tenant_id from the model instance and validates against
        current context.
        
        Args:
            model: The model instance to validate access for.
            tenant_id_field: Name of the tenant_id field in the model.
                           Defaults to 'tenant_id' per constraint C-003.
        
        Returns:
            IsolationCheckResult with decision and metadata.
        
        Raises:
            TenantContextRequiredError: If context is not set.
            TenantAccessDeniedError: In strict_mode when tenant mismatch.
            AttributeError: If model lacks tenant_id field.
        """
        self.validate_context_exists()
        
        # Extract tenant_id from model
        if not hasattr(model, tenant_id_field):
            logger.error(
                f"Model {type(model).__name__} missing tenant_id field. "
                f"This violates constraint C-003."
            )
            raise AttributeError(
                f"Model {type(model).__name__} must have '{tenant_id_field}' field. "
                f"Per constraint C-003, all models must include tenant_id."
            )
        
        resource_tenant_id = getattr(model, tenant_id_field)
        
        if resource_tenant_id is None:
            logger.error(
                f"Model {type(model).__name__} has null tenant_id. "
                f"This violates constraint C-003."
            )
            raise TenantAccessDeniedError(
                "Cannot access resource with null tenant_id"
            )
        
        return self.validate_resource_access(
            resource_tenant_id=resource_tenant_id,
            resource_type=type(model).__name__,
            resource_id=getattr(model, "id", None),
        )
    
    def validate_list_access(
        self,
        models: List[Any],
        tenant_id_field: str = "tenant_id",
    ) -> List[Any]:
        """
        Filter a list of models to only include those from current tenant.
        
        This provides defense-in-depth by ensuring even if a query
        returns cross-tenant data (which should not happen), it gets
        filtered at the service layer.
        
        Args:
            models: List of model instances to filter.
            tenant_id_field: Name of tenant_id field.
        
        Returns:
            Filtered list containing only models from current tenant.
        
        Raises:
            TenantContextRequiredError: If context not set.
        """
        self.validate_context_exists()
        current_tenant_id = self.get_current_tenant_id()
        
        filtered = []
        for model in models:
            try:
                model_tenant_id = getattr(model, tenant_id_field, None)
                if model_tenant_id == current_tenant_id:
                    filtered.append(model)
                else:
                    # Log cross-tenant data leak detection
                    if self._enable_audit_logging:
                        self._audit_logger.warning(
                            "DEFENSE_IN_DEPTH: Cross-tenant data detected in query result. "
                            f"Model={type(model).__name__}, "
                            f"expected_tenant={current_tenant_id}, "
                            f"actual_tenant={model_tenant_id}"
                        )
            except AttributeError:
                # Model without tenant_id field - skip per C-003
                pass
        
        return filtered
    
    def validate_foreign_key_access(
        self,
        parent_tenant_id: str,
        child_tenant_id: Optional[str],
        relation_name: str = "unknown",
    ) -> IsolationCheckResult:
        """
        Validate cross-tenant foreign key access.
        
        Per constraint C-003, foreign key relationships must validate
        that related entities belong to the same tenant.
        
        Args:
            parent_tenant_id: Tenant ID of the parent entity.
            child_tenant_id: Tenant ID of the child entity (may be None).
            relation_name: Name of the relationship for logging.
        
        Returns:
            IsolationCheckResult with validation decision.
        """
        if child_tenant_id is None:
            # Allow - child may not have tenant association
            return IsolationCheckResult(
                decision=AccessDecision.ALLOWED,
                current_tenant_id=self.get_current_tenant_id(),
                resource_tenant_id=parent_tenant_id,
            )
        
        if parent_tenant_id != child_tenant_id:
            result = IsolationCheckResult(
                decision=AccessDecision.DENIED_CROSS_TENANT,
                current_tenant_id=self.get_current_tenant_id(),
                resource_tenant_id=parent_tenant_id,
                reason=f"Cross-tenant FK access denied on relation '{relation_name}'",
            )
            self._log_cross_tenant_attempt(result)
            
            if self._strict_mode:
                raise TenantAccessDeniedError(result.reason)
            
            return result
        
        return IsolationCheckResult(
            decision=AccessDecision.ALLOWED,
            current_tenant_id=self.get_current_tenant_id(),
            resource_tenant_id=parent_tenant_id,
        )
    
    def _log_cross_tenant_attempt(
        self,
        result: IsolationCheckResult,
    ) -> None:
        """
        Log cross-tenant access attempt for security audit.
        
        Per constraint C-002, all cross-tenant access attempts must be
        logged for security audit and alerting.
        
        Args:
            result: The isolation check result to log.
        """
        if not self._enable_audit_logging:
            return
        
        log_data = {
            "event": "CROSS_TENANT_ACCESS_ATTEMPT",
            "decision": result.decision.value,
            "current_tenant": result.current_tenant_id,
            "target_tenant": result.resource_tenant_id,
            "reason": result.reason,
            "resource_type": result.metadata.get("resource_type"),
            "resource_id": result.metadata.get("resource_id"),
        }
        
        self._audit_logger.warning(
            "Cross-tenant access denied: %(event)s | "
            "from_tenant=%(current_tenant)s | "
            "target_tenant=%(target_tenant)s | "
            "reason=%(reason)s",
            log_data,
        )
    
    def create_tenant_filter(
        self,
        model_class: Type,
        extra_filters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a filter dictionary that enforces tenant isolation.
        
        This method generates query filters that should be applied to
        all database queries to ensure tenant isolation at the ORM level.
        
        Args:
            model_class: The model class to create filters for.
            extra_filters: Additional filters to merge.
        
        Returns:
            Dictionary of filters including tenant_id constraint.
        
        Raises:
            TenantContextRequiredError: If context not set.
        
        Example:
            # Usage with SQLAlchemy
            filters = service.create_tenant_filter(User)
            results = db.query(User).filter_by(**filters).all()
        """
        self.validate_context_exists()
        current_tenant_id = self.get_current_tenant_id()
        
        base_filter = {"tenant_id": current_tenant_id}
        
        if extra_filters:
            base_filter.update(extra_filters)
        
        return base_filter


# Module-level convenience functions for common operations

def validate_current_tenant_has_access(resource_tenant_id: str) -> None:
    """
    Validate that the current tenant can access the given resource.
    
    Convenience wrapper that raises exception on access denial.
    
    Args:
        resource_tenant_id: Tenant ID of the target resource.
    
    Raises:
        TenantAccessDeniedError: If access is denied.
    """
    service = TenantIsolationService()
    result = service.validate_resource_access(resource_tenant_id)
    if not result.is_allowed:
        raise TenantAccessDeniedError(result.reason)


def require_tenant_context() -> str:
    """
    Require tenant context to be set, returning the current tenant_id.
    
    Returns:
        The current tenant_id.
    
    Raises:
        TenantContextRequiredError: If context not set.
    """
    service = TenantIsolationService()
    service.validate_context_exists()
    return service.get_current_tenant_id()  # type: ignore