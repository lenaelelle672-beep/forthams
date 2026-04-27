"""Asset status enumeration for retirement workflow."""

from enum import Enum
class AssetStatus(str, Enum):
    """Asset lifecycle status values."""

    IN_SERVICE = "IN_SERVICE"       # 在用
    IDLE = "IDLE"                   # 闲置
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE"  # 维保中
    PENDING_RETIREMENT = "PENDING_RETIREMENT"  # 待退役（申请中）
    RETIRED = "RETIRED"            # 已退役
    SCRAPPED = "SCRAPPED"          # 已报废