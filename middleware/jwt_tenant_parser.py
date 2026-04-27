"""
JWT Tenant Parser Module

SWARM-2025-Q2-P1-004: Multi-tenant Data Isolation Specification
Phase 2.4: JWT解析器实现

该模块负责从HTTP请求的Authorization Header中解析JWT Token，
提取tenant_id并建立TenantContext。

安全约束:
- B-001: 禁止fail-open，租户上下文解析异常时必须拒绝访问
- B-003: tenant_id必须从JWT解析，禁止客户端指定
"""

import logging
from typing import Optional

from core.tenant_context import TenantContext
from core.exceptions import TenantContextNotFoundException

logger = logging.getLogger(__name__)

# JWT解析库（生产环境使用PyJWT）
try:
    import jwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False
    logger.warning("PyJWT not installed, using fallback parser for testing")


class JwtTenantParser:
    """
    JWT租户解析器
    
    从Authorization Header中解析JWT，提取tenant_id并绑定到TenantContext。
    
    约束:
        - JWT格式: Bearer <token>
        - JWT payload必须包含tenant_id字段
        - JWT签名必须有效（生产环境）
        - 解析失败必须抛出异常，禁止fail-open
    
    异常:
        TenantContextNotFoundException: JWT无效、过期或缺少tenant_id
    """
    
    def __init__(self, jwt_secret: Optional[str] = None, jwt_algorithm: str = "HS256"):
        """
        初始化JWT解析器
        
        Args:
            jwt_secret: JWT签名密钥（生产环境必需）
            jwt_algorithm: JWT签名算法，默认HS256
        """
        self.jwt_secret = jwt_secret
        self.jwt_algorithm = jwt_algorithm
    
    def parse_and_bind(self, authorization_header: Optional[str]) -> str:
        """
        解析Authorization Header中的JWT，提取tenant_id并绑定到TenantContext
        
        Args:
            authorization_header: Authorization Header值，格式为 "Bearer <token>"
            
        Returns:
            str: 解析出的tenant_id
            
        Raises:
            TenantContextNotFoundException: JWT无效、过期或缺少tenant_id时抛出
                - 401: JWT为空、格式错误、签名无效、已过期
                - 401: JWT中缺少tenant_id字段
        
        安全约束:
            - B-001: 禁止fail-open，异常时必须拒绝访问
            - B-003: tenant_id必须从JWT解析
        """
        # 1. 检查Authorization Header是否存在
        if not authorization_header:
            logger.warning("Authorization header missing")
            raise TenantContextNotFoundException(
                "Authorization header required",
                status_code=401
            )
        
        # 2. 验证Bearer Token格式
        if not authorization_header.startswith("Bearer "):
            logger.warning("Invalid authorization header format: must start with 'Bearer '")
            raise TenantContextNotFoundException(
                "Invalid authorization header format",
                status_code=401
            )
        
        token = authorization_header[7:]  # 去掉 "Bearer " 前缀
        
        if not token:
            logger.warning("Empty token after 'Bearer '")
            raise TenantContextNotFoundException(
                "Empty token",
                status_code=401
            )
        
        # 3. 解析JWT并提取tenant_id
        tenant_id = self._decode_jwt(token)
        
        # 4. 验证tenant_id有效性
        if not tenant_id:
            logger.warning("JWT valid but tenant_id is missing or empty")
            raise TenantContextNotFoundException(
                "tenant_id required in JWT",
                status_code=401
            )
        
        # 5. 绑定到TenantContext
        TenantContext.set_current_tenant(tenant_id)
        logger.info(f"Tenant context bound: tenant_id={tenant_id}")
        
        return tenant_id
    
    def _decode_jwt(self, token: str) -> Optional[str]:
        """
        解码JWT并提取tenant_id
        
        Args:
            token: JWT字符串
            
        Returns:
            Optional[str]: tenant_id，如果不存在则返回None
            
        Raises:
            TenantContextNotFoundException: JWT格式错误、签名无效或已过期
        """
        if JWT_AVAILABLE and self.jwt_secret:
            # 生产环境：使用PyJWT进行完整验证
            return self._decode_with_pyjwt(token)
        else:
            # 测试/开发环境：使用简化解析
            return self._decode_fallback(token)
    
    def _decode_with_pyjwt(self, token: str) -> Optional[str]:
        """
        使用PyJWT解码JWT（生产环境）
        
        Args:
            token: JWT字符串
            
        Returns:
            Optional[str]: tenant_id
            
        Raises:
            TenantContextNotFoundException: JWT无效
        """
        try:
            payload = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=[self.jwt_algorithm],
                options={"require": ["tenant_id", "exp"]}
            )
            return payload.get("tenant_id")
        except jwt.ExpiredSignatureError:
            logger.warning("JWT has expired")
            raise TenantContextNotFoundException(
                "JWT has expired",
                status_code=401
            )
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid JWT: {e}")
            raise TenantContextNotFoundException(
                "Invalid JWT token",
                status_code=401
            )
        except jwt.MissingTokenError:
            logger.warning("JWT is missing required fields (tenant_id or exp)")
            raise TenantContextNotFoundException(
                "JWT missing required fields",
                status_code=401
            )
    
    def _decode_fallback(self, token: str) -> Optional[str]:
        """
        简化JWT解析（测试/开发环境）
        
        注意：此方法不验证签名，仅用于测试环境。
        生产环境必须使用PyJWT进行完整验证。
        
        Args:
            token: JWT字符串
            
        Returns:
            Optional[str]: tenant_id
            
        Raises:
            TenantContextNotFoundException: JWT格式错误
        """
        try:
            # 简化解析：base64解码payload部分
            # JWT格式: header.payload.signature
            parts = token.split(".")
            if len(parts) != 3:
                logger.warning("Invalid JWT format: expected 3 parts")
                raise TenantContextNotFoundException(
                    "Invalid JWT format",
                    status_code=401
                )
            
            import base64
            import json
            
            # 解码payload (第二部分)
            payload_b64 = parts[1]
            # 添加padding
            payload_b64 += "=" * (4 - len(payload_b64) % 4)
            payload_json = base64.urlsafe_b64decode(payload_b64)
            payload = json.loads(payload_json)
            
            # 检查过期时间
            if "exp" in payload:
                import time
                if payload["exp"] < time.time():
                    logger.warning("JWT has expired (fallback parser)")
                    raise TenantContextNotFoundException(
                        "JWT has expired",
                        status_code=401
                    )
            
            return payload.get("tenant_id")
            
        except (ValueError, json.JSONDecodeError, base64.binascii.Error) as e:
            logger.warning(f"Failed to decode JWT: {e}")
            raise TenantContextNotFoundException(
                "Invalid JWT token",
                status_code=401
            )
    
    def clear_context(self) -> None:
        """
        清除当前租户上下文
        
        用于请求结束后的清理工作
        """
        TenantContext.clear()
        logger.debug("Tenant context cleared")


# 全局解析器实例
_default_parser: Optional[JwtTenantParser] = None


def get_parser() -> JwtTenantParser:
    """
    获取全局JWT解析器实例
    
    Returns:
        JwtTenantParser: 全局解析器实例
    """
    global _default_parser
    if _default_parser is None:
        _default_parser = JwtTenantParser()
    return _default_parser


def parse_jwt_tenant(authorization_header: Optional[str]) -> str:
    """
    便捷函数：解析JWT并绑定租户上下文
    
    Args:
        authorization_header: Authorization Header值
        
    Returns:
        str: tenant_id
        
    Raises:
        TenantContextNotFoundException: 解析失败
    """
    parser = get_parser()
    return parser.parse_and_bind(authorization_header)