"""折旧方法实体模块

定义资产折旧计算所支持的折旧方法枚举类型。
支持直线法和双倍余额递减法两种主流折旧计算方式。

Version: 1.0.0
Created: 2026-Q2
Module: SWARM-2026-Q2-003 Iteration 2
"""

from enum import Enum
from typing import Optional, Dict, Any
from decimal import Decimal


class DepreciationMethod(Enum):
    """折旧方法枚举
    
    定义资产折旧计算支持的折旧方法类型。
    
    Attributes:
        STRAIGHT_LINE: 直线法，也称为平均年限法
            - 每月折旧额 = (原值 - 残值) / 预计使用月数
            - 适用于使用情况稳定的固定资产
            
        DOUBLE_DECLINING: 双倍余额递减法，也称为加速折旧法
            - 年折旧率 = 2 / 预计使用年限
            - 前期折旧额高，后期折旧额低
            - 需注意最后两年需转换为直线法计算
            
    Example:
        >>> method = DepreciationMethod.STRAIGHT_LINE
        >>> method.value
        'straight_line'
        
        >>> method = DepreciationMethod.DOUBLE_DECLINING
        >>> method.value
        'double_declining'
    """
    
    STRAIGHT_LINE = "straight_line"
    DOUBLE_DECLINING = "double_declining"
    
    @classmethod
    def from_string(cls, value: str) -> "DepreciationMethod":
        """从字符串值转换为枚举成员
        
        Args:
            value: 折旧方法字符串值
            
        Returns:
            DepreciationMethod: 对应的枚举成员
            
        Raises:
            ValueError: 当值不属于已定义的折旧方法时抛出
            
        Example:
            >>> method = DepreciationMethod.from_string("straight_line")
            >>> method == DepreciationMethod.STRAIGHT_LINE
            True
        """
        for member in cls:
            if member.value == value:
                return member
        valid_methods = [m.value for m in cls]
        raise ValueError(f"Invalid depreciation method '{value}', valid values are: {valid_methods}")
    
    @classmethod
    def is_accelerated(cls, method: "DepreciationMethod") -> bool:
        """判断是否为加速折旧法
        
        Args:
            method: 折旧方法枚举成员
            
        Returns:
            bool: 如果是加速折旧法返回 True，否则返回 False
        """
        return method == cls.DOUBLE_DECLINING
    
    def get_description(self) -> str:
        """获取折旧方法的描述信息
        
        Returns:
            str: 折旧方法的详细描述
        """
        descriptions: Dict[str, str] = {
            "straight_line": "直线法：在预计使用年限内，平均分摊固定资产的应折旧金额",
            "double_declining": "双倍余额递减法：前期折旧额高，后期折旧额低，加速资产价值转移"
        }
        return descriptions.get(self.value, "")
    
    def get_formula_description(self) -> str:
        """获取折旧计算公式描述
        
        Returns:
            str: 折旧计算公式的详细描述
        """
        formulas: Dict[str, str] = {
            "straight_line": "月折旧额 = (原值 - 残值) / 预计使用月数",
            "double_declining": "年折旧率 = 2 / 预计使用年限；月折旧额 = 年初账面价值 × 年折旧率 / 12"
        }
        return formulas.get(self.value, "")