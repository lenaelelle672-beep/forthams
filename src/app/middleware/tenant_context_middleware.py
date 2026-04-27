"""
TenantContextMiddleware - 多租户上下文中间件

从 HTTP 请求的 Authorization Header 中解析 JWT，提取 tenant_id，
并将其绑定到请求级 TenantContext 中。

依赖:
- TenantContext (from src.core.tenant_context)
- JWT 解码逻辑 (from src.core.security.jwt_handler)

异常:
- TenantContextError: JWT 缺少 tenant_id claim
- JWTExpiredError: JWT 已过期
- JWTInvalidSignatureError: JWT 签名验证失败
"""

import logging
from typing import Optional

import jwt

from src.core.tenant_context import TenantContext

logger = logging.getLogger(__name__)


class TenantContextError(Exception):
    """租户上下文相关错误基类"""
    pass


class JWTExpiredError(Exception):
    """JWT 已过期错误"""
    pass


class JWTInvalidSignatureError(Exception):
    """JWT 签名验证失败错误"""
    pass


class TenantContextMiddleware:
    """
    多租户上下文中间件
    
    职责:
    1. 从 HTTP 请求的 Authorization Header 中解析 JWT
    2. 从 JWT payload 中提取 tenant_id claim
    3. 将 tenant_id 写入 TenantContext (请求级上下文)
    4. 请求结束时清理 TenantContext
    
    前置条件:
    - 请求必须包含有效的 Authorization Header
    - JWT 中必须包含 tenant_id claim
    
    后置条件:
    - TenantContext.current_tenant_id 被正确设置
    - 请求结束后 TenantContext 被正确清理
    """
    
    def __init__(
        self, 
        app, 
        jwt_secret: str, 
        jwt_algorithm: str = "HS256"
    ):
        """
        初始化中间件
        
        Args:
            app: ASGI 应用实例
            jwt_secret: JWT 签名密钥
            jwt_algorithm: JWT 算法，默认 HS256
        """
        self.app = app
        self.jwt_secret = jwt_secret
        self.jwt_algorithm = jwt_algorithm
    
    async def __call__(self, scope, receive, send):
        """
        ASGI 中间件入口
        
        Args:
            scope: ASGI Scope
            receive: ASGI Receive
            send: ASGI Send
        
        Returns:
            None
        
        Raises:
            TenantContextError: JWT 缺少 tenant_id claim
            JWTExpiredError: JWT 已过期
            JWTInvalidSignatureError: JWT 签名验证失败
        """
        if scope["type"] != "http":
            # 非 HTTP 请求直接透传
            await self.app(scope, receive, send)
            return
        
        try:
            # 1. 解析 Authorization Header
            authorization = self._get_authorization_header(scope)
            
            if authorization:
                # 2. 解码 JWT
                payload = self._decode_jwt(authorization)
                
                # 3. 提取 tenant_id
                tenant_id = payload.get("tenant_id")
                if not tenant_id:
                    raise TenantContextError("Missing tenant_id in JWT")
                
                # 4. 设置租户上下文
                TenantContext.set(tenant_id)
            else:
                # 无 Authorization，TenantContext 保持未设置状态
                logger.warning("No Authorization header in request")
            
            # 5. 执行下游应用
            await self.app(scope, receive, send)
            
        except (TenantContextError, JWTExpiredError, JWTInvalidSignatureError):
            # 异常向上传播，由上层处理
            raise
        finally:
            # 6. 清理租户上下文
            TenantContext.clear()
    
    def _get_authorization_header(self, scope) -> Optional[str]:
        """
        从 ASGI Scope 中提取 Authorization Header
        
        Args:
            scope: ASGI Scope
        
        Returns:
            Authorization Header 值，不存在则返回 None
        """
        for name, value in scope.get("headers", []):
            if name == b"authorization":
                return value.decode("utf-8")
        return None
    
    def _decode_jwt(self, authorization: str) -> dict:
        """
        解码 JWT Token
        
        Args:
            authorization: Authorization Header 值 (Bearer <token>)
        
        Returns:
            JWT Payload
        
        Raises:
            TenantContextError: Authorization header 格式无效
            JWTInvalidSignatureError: 签名验证失败
            JWTExpiredError: Token 已过期
        """
        if not authorization.startswith("Bearer "):
            raise TenantContextError("Invalid Authorization header format: must start with 'Bearer '")
        
        token = authorization[7:]  # 去掉 "Bearer " 前缀
        
        try:
            # 使用 jwt 库解码
            payload = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=[self.jwt_algorithm]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise JWTExpiredError("JWT token has expired")
        except jwt.InvalidSignatureError:
            raise JWTInvalidSignatureError("JWT signature verification failed")
        except jwt.DecodeError as e:
            raise TenantContextError(f"Invalid JWT token format: {str(e)}")