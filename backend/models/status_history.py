"""
资产状态历史模型模块

本模块定义了资产报废/退役流程相关的核心数据模型，包括：
- AssetRetirementRequest: 资产报废申请表
- ApprovalRecord: 审批链路记录
- AssetRetirementHistory: 资产退役历史事件

SWARM-002 资产报废/退役流程核心模型

Author: AMS Development Team
Version: 1.0.0
"""

from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from decimal import Decimal


class RetirementReason(models.TextChoices):
    """
    报废原因枚举
    
    定义资产报废申请的可选原因类型
    """
    CONDEMNED = 'CONDEMNED', '强制报废'
    DAMAGED = 'DAMAGED', '损毁报废'
    UPGRADE = 'UPGRADE', '升级换代'
    OTHER = 'OTHER', '其他原因'


class DisposalMethod(models.TextChoices):
    """
    处置方式枚举
    
    定义资产报废后的处置方式选项
    """
    SCRAP = 'SCRAP', '报废销毁'
    AUCTION = 'AUCTION', '拍卖处置'
    TRANSFER = 'TRANSFER', '转让调拨'
    DONATION = 'DONATION', '捐赠处理'


class RetirementStatus(models.TextChoices):
    """
    报废申请状态枚举
    
    遵循状态机流转规则：DRAFT → PENDING → APPROVED/REJECTED → COMPLETED
    """
    DRAFT = 'DRAFT', '草稿'
    PENDING = 'PENDING', '待审批'
    APPROVED = 'APPROVED', '已批准'
    REJECTED = 'REJECTED', '已驳回'
    COMPLETED = 'COMPLETED', '已完成'


class RetirementEventType(models.TextChoices):
    """
    退役历史事件类型枚举
    
    记录资产退役全生命周期中的关键事件
    """
    REQUEST_CREATED = 'REQUEST_CREATED', '申请创建'
    SUBMITTED = 'SUBMITTED', '申请提交'
    APPROVAL_GRANTED = 'APPROVAL_GRANTED', '审批通过'
    REJECTED = 'REJECTED', '审批驳回'
    COMPLETED = 'COMPLETED', '退役完成'
    CANCELLED = 'CANCELLED', '申请取消'


class ApprovalDecision(models.TextChoices):
    """
    审批决策枚举
    
    定义审批节点的处理结果
    """
    APPROVE = 'APPROVE', '批准'
    REJECT = 'REJECT', '驳回'


class AssetRetirementRequest(models.Model):
    """
    资产报废申请表
    
    记录用户提交的资产报废申请，包含申请信息、审批路由元数据
    
    Attributes:
        asset_id: 关联的资产ID
        requester_id: 申请人用户ID
        retirement_reason: 报废原因
        estimated_residual_value: 预估残值
        disposal_method: 处置方式
        current_status: 当前状态
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    asset_id = models.ForeignKey(
        'Asset',
        on_delete=models.PROTECT,
        related_name='retirement_requests',
        help_text='关联的资产ID'
    )
    
    requester_id = models.ForeignKey(
        'User',
        on_delete=models.PROTECT,
        related_name='submitted_retirement_requests',
        help_text='申请人用户ID'
    )
    
    retirement_reason = models.CharField(
        max_length=20,
        choices=RetirementReason.choices,
        default=RetirementReason.OTHER,
        help_text='报废原因'
    )
    
    estimated_residual_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        default=Decimal('0.00'),
        help_text='预估残值(元)'
    )
    
    disposal_method = models.CharField(
        max_length=20,
        choices=DisposalMethod.choices,
        default=DisposalMethod.SCRAP,
        help_text='处置方式'
    )
    
    current_status = models.CharField(
        max_length=20,
        choices=RetirementStatus.choices,
        default=RetirementStatus.DRAFT,
        help_text='当前状态'
    )
    
    approval_chain_id = models.ForeignKey(
        'ApprovalChain',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='retirement_requests',
        help_text='关联的审批链路ID'
    )
    
    description = models.TextField(
        blank=True,
        default='',
        help_text='申请备注说明'
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text='创建时间'
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text='更新时间'
    )
    
    submitted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='提交时间'
    )
    
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='完成时间'
    )
    
    class Meta:
        """
        模型元数据
        
        定义表名、索引、约束等数据库层面的配置
        """
        db_table = 'asset_retirement_request'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['asset_id', 'current_status'], name='idx_asset_status'),
            models.Index(fields=['requester_id'], name='idx_requester'),
            models.Index(fields=['created_at'], name='idx_created_at'),
            models.Index(fields=['current_status'], name='idx_status'),
        ]
        # 确保同一资产在同一时刻只允许存在一条PENDING状态的申请
        constraints = [
            models.UniqueConstraint(
                fields=['asset_id'],
                condition=models.Q(current_status=RetirementStatus.PENDING),
                name='unique_pending_retirement_per_asset'
            )
        ]
    
    def __str__(self):
        """返回对象的可读字符串表示"""
        return f"RetirementRequest({self.id}) - Asset({self.asset_id}) - {self.current_status}"
    
    def submit(self):
        """
        提交报废申请
        
        将申请状态从DRAFT变更为PENDING，并记录提交时间
        
        Returns:
            bool: 提交是否成功
        """
        if self.current_status != RetirementStatus.DRAFT:
            return False
        
        self.current_status = RetirementStatus.PENDING
        self.submitted_at = timezone.now()
        self.save(update_fields=['current_status', 'submitted_at', 'updated_at'])
        return True
    
    def approve(self):
        """
        批准报废申请
        
        将申请状态变更为APPROVED
        
        Returns:
            bool: 批准是否成功
        """
        if self.current_status != RetirementStatus.PENDING:
            return False
        
        self.current_status = RetirementStatus.APPROVED
        self.save(update_fields=['current_status', 'updated_at'])
        return True
    
    def reject(self):
        """
        驳回报废申请
        
        将申请状态变更为REJECTED
        
        Returns:
            bool: 驳回是否成功
        """
        if self.current_status != RetirementStatus.PENDING:
            return False
        
        self.current_status = RetirementStatus.REJECTED
        self.save(update_fields=['current_status', 'updated_at'])
        return True
    
    def complete(self):
        """
        完成报废流程
        
        将申请状态变更为COMPLETED，并记录完成时间
        
        Returns:
            bool: 完成是否成功
        """
        if self.current_status != RetirementStatus.APPROVED:
            return False
        
        self.current_status = RetirementStatus.COMPLETED
        self.completed_at = timezone.now()
        self.save(update_fields=['current_status', 'completed_at', 'updated_at'])
        return True


class ApprovalRecord(models.Model):
    """
    审批链路记录模型
    
    记录报废申请的审批链路节点，包含审批人、决策、时间等信息
    
    Attributes:
        request_id: 关联的报废申请ID
        approver_id: 审批人用户ID
        approval_level: 审批层级(1/2/3)
        decision: 审批决策
        comments: 审批意见
        decided_at: 决策时间
    """
    
    request = models.ForeignKey(
        AssetRetirementRequest,
        on_delete=models.CASCADE,
        related_name='approval_records',
        help_text='关联的报废申请ID'
    )
    
    approver_id = models.ForeignKey(
        'User',
        on_delete=models.PROTECT,
        related_name='approval_actions',
        help_text='审批人用户ID'
    )
    
    approval_level = models.PositiveIntegerField(
        default=1,
        help_text='审批层级(1=一级审批, 2=二级审批, 3=三级审批)'
    )
    
    decision = models.CharField(
        max_length=20,
        choices=ApprovalDecision.choices,
        null=True,
        blank=True,
        help_text='审批决策(APPROVE/REJECT)'
    )
    
    comments = models.TextField(
        blank=True,
        default='',
        help_text='审批意见'
    )
    
    decided_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='决策时间'
    )
    
    # 审批节点状态
    is_pending = models.BooleanField(
        default=True,
        help_text='是否待处理'
    )
    
    # 审批超时相关
    timeout_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='超时时间(72小时后自动升级)'
    )
    
    upgraded_to = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='upgraded_approvals',
        help_text='超时升级后的接替审批人'
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text='创建时间'
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text='更新时间'
    )
    
    class Meta:
        """
        模型元数据
        
        定义表名、索引等数据库层面的配置
        """
        db_table = 'approval_record'
        ordering = ['approval_level', 'created_at']
        indexes = [
            models.Index(fields=['request_id', 'approval_level'], name='idx_request_level'),
            models.Index(fields=['approver_id'], name='idx_approver'),
            models.Index(fields=['is_pending'], name='idx_pending'),
        ]
    
    def __str__(self):
        """返回对象的可读字符串表示"""
        status = 'PENDING' if self.is_pending else self.decision
        return f"ApprovalRecord({self.id}) - Level({self.approval_level}) - {status}"
    
    def approve(self, comments=''):
        """
        执行批准操作
        
        Args:
            comments: 审批意见
        
        Returns:
            bool: 批准是否成功
        """
        if not self.is_pending:
            return False
        
        self.decision = ApprovalDecision.APPROVE
        self.comments = comments
        self.decided_at = timezone.now()
        self.is_pending = False
        self.save(update_fields=['decision', 'comments', 'decided_at', 'is_pending', 'updated_at'])
        return True
    
    def reject(self, comments=''):
        """
        执行驳回操作
        
        Args:
            comments: 驳回意见
        
        Returns:
            bool: 驳回是否成功
        """
        if not self.is_pending:
            return False
        
        self.decision = ApprovalDecision.REJECT
        self.comments = comments
        self.decided_at = timezone.now()
        self.is_pending = False
        self.save(update_fields=['decision', 'comments', 'decided_at', 'is_pending', 'updated_at'])
        return True
    
    def is_processed(self):
        """
        检查审批节点是否已处理
        
        Returns:
            bool: 是否已处理
        """
        return not self.is_pending


class AssetRetirementHistory(models.Model):
    """
    资产退役历史事件模型
    
    记录资产退役全流程中的所有关键事件，用于审计追踪和流程回放
    
    Attributes:
        asset_id: 关联的资产ID
        event_type: 事件类型
        event_data: 事件详情(JSON格式)
        operator_id: 操作人用户ID
        event_timestamp: 事件发生时间
    """
    
    asset_id = models.ForeignKey(
        'Asset',
        on_delete=models.PROTECT,
        related_name='retirement_histories',
        help_text='关联的资产ID'
    )
    
    request = models.ForeignKey(
        AssetRetirementRequest,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='history_events',
        help_text='关联的报废申请ID'
    )
    
    event_type = models.CharField(
        max_length=30,
        choices=RetirementEventType.choices,
        help_text='事件类型'
    )
    
    event_data = models.JSONField(
        default=dict,
        help_text='事件详情(JSON格式，包含完整的上下文用于调试)'
    )
    
    operator_id = models.ForeignKey(
        'User',
        on_delete=models.PROTECT,
        related_name='retirement_operations',
        help_text='操作人用户ID'
    )
    
    event_timestamp = models.DateTimeField(
        auto_now_add=True,
        help_text='事件发生时间(不可篡改，由数据库自动设置)'
    )
    
    # 保留操作者IP和时间戳用于审计
    operator_ip = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text='操作者IP地址'
    )
    
    description = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text='事件描述'
    )
    
    class Meta:
        """
        模型元数据
        
        定义表名、索引等数据库层面的配置
        """
        db_table = 'asset_retirement_history'
        ordering = ['event_timestamp']
        indexes = [
            models.Index(fields=['asset_id', 'event_timestamp'], name='idx_history_asset_time'),
            models.Index(fields=['event_type'], name='idx_event_type'),
            models.Index(fields=['operator_id'], name='idx_operator'),
        ]
    
    def __str__(self):
        """返回对象的可读字符串表示"""
        return f"RetirementHistory({self.id}) - {self.event_type} - {self.event_timestamp}"
    
    @classmethod
    def record_event(cls, asset_id, event_type, operator_id, event_data=None, operator_ip=None, request=None, description=''):
        """
        记录退役历史事件
        
        便捷的工厂方法，用于创建新的历史记录
        
        Args:
            asset_id: 资产ID
            event_type: 事件类型
            operator_id: 操作人ID
            event_data: 事件数据字典
            operator_ip: 操作者IP
            request: 关联的报废申请
            description: 事件描述
        
        Returns:
            AssetRetirementHistory: 创建的历史记录实例
        """
        return cls.objects.create(
            asset_id_id=asset_id,
            event_type=event_type,
            operator_id_id=operator_id,
            event_data=event_data or {},
            operator_ip=operator_ip,
            request=request,
            description=description
        )
    
    @classmethod
    def get_asset_retirement_timeline(cls, asset_id):
        """
        获取资产退役时间线
        
        Args:
            asset_id: 资产ID
        
        Returns:
            QuerySet: 按时间升序排列的历史事件列表
        """
        return cls.objects.filter(
            asset_id_id=asset_id
        ).order_by('event_timestamp')