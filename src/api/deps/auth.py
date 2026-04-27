"""
认证与鉴权依赖模块。

为 FastAPI 路由提供可注入的依赖项，包括当前用户获取、
角色校验等，用于接口级权限控制。
"""

from typing import List, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

# ---------------------------------------------------------------------------
# OAuth2 scheme —— 从 Authorization header 提取 Bearer token
# ---------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(auto_error=False)


# ---------------------------------------------------------------------------
# 用户模型（轻量级，仅用于依赖注入上下文）
# ---------------------------------------------------------------------------
class CurrentUser:
    """当前请求的已认证用户信息。

    Attributes:
        user_id: 用户唯一标识。
        username: 用户名。
        roles: 用户拥有的角色列表。
        tenant_id: 所属租户标识（多租户场景）。
    """

    def __init__(
        self,
        user_id: str,
        username: str,
        roles: List[str],
        tenant_id: Optional[str] = None,
    ) -> None:
        """初始化当前用户实例。

        Args:
            user_id: 用户唯一标识。
            username: 用户名。
            roles: 用户角色列表。
            tenant_id: 可选的租户标识。
        """
        self.user_id = user_id
        self.username = username
        self.roles = roles
        self.tenant_id = tenant_id

    def has_role(self, role: str) -> bool:
        """判断用户是否拥有指定角色。

        Args:
            role: 待检查的角色名称。

        Returns:
            若用户角色列表中包含该角色则返回 True，否则 False。
        """
        return role in self.roles

    def has_any_role(self, roles: List[str]) -> bool:
        """判断用户是否拥有给定角色列表中的任一角色。

        Args:
            roles: 待检查的角色名称列表。

        Returns:
            若用户角色列表与给定列表有交集则返回 True，否则 False。
        """
        return bool(set(self.roles) & set(roles))


# ---------------------------------------------------------------------------
# 获取当前用户依赖
# ---------------------------------------------------------------------------
async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
) -> CurrentUser:
    """从请求中解析并返回当前已认证用户。

    该依赖从 OAuth2 Bearer token 中解码用户信息，
    若 token 缺失或无效则抛出 401 异常。

    Args:
        token: 由 OAuth2PasswordBearer 自动提取的 JWT token。

    Returns:
        当前已认证用户实例。

    Raises:
        HTTPException: 当 token 缺失或无效时返回 401 Unauthorized。
    """
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # TODO: 接入真实 JWT 解码逻辑，当前为占位实现
    # 生产环境应替换为 JWT 解码 + 数据库/缓存校验
    try:
        # 占位：从 token 中解析用户信息
        # 实际实现应调用 jwt.decode 并校验签名与过期时间
        _placeholder_user = CurrentUser(
            user_id="placeholder",
            username="placeholder",
            roles=[],
        )
        return _placeholder_user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# ---------------------------------------------------------------------------
# 角色鉴权工厂
# ---------------------------------------------------------------------------
def require_roles(*allowed_roles: str):
    """创建一个角色鉴权依赖，仅允许拥有指定角色的用户通过。

    使用 FastAPI Depends 机制，将角色校验作为可注入依赖。
    若当前用户不具备任一允许角色，则返回 403 Forbidden。

    Args:
        *allowed_roles: 允许访问的角色名称可变参数。

    Returns:
        一个 FastAPI 依赖函数，校验通过后返回 CurrentUser 实例。

    Example::

        @router.get("/audit-log/list", dependencies=[Depends(require_roles("admin", "auditor"))])
        async def list_audit_logs(): ...
    """
    roles_list = list(allowed_roles)

    async def _role_checker(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        """校验当前用户是否拥有允许的角色之一。

        Args:
            current_user: 由 get_current_user 依赖注入的当前用户。

        Returns:
            校验通过后返回当前用户实例。

        Raises:
            HTTPException: 当用户不具备任何允许角色时返回 403 Forbidden。
        """
        if not current_user.has_any_role(roles_list):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Permission denied. "
                    f"Required role: any of {roles_list}, "
                    f"but user '{current_user.username}' has roles: {current_user.roles}"
                ),
            )
        return current_user

    return _role_checker


# ---------------------------------------------------------------------------
# 审计日志专用鉴权依赖
# ---------------------------------------------------------------------------
# 仅 admin 或 auditor 角色可访问审计日志仪表板及对应 API
require_audit_access = require_roles("admin", "auditor")
"""审计日志接口鉴权依赖。

仅具有 admin 或 auditor 角色的用户可访问审计日志相关 API，
包括 /api/v1/audit-log/list、/api/v1/audit-log/trend、
/api/v1/audit-log/meta 等端点。

使用方式::

    @router.get("/audit-log/list")
    async def list_audit_logs(
        current_user: CurrentUser = Depends(require_audit_access),
    ):
        ...
"""