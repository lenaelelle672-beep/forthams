"""
资产报废退役历史记录模型

本模块定义资产退役流程中的操作历史记录，用于追踪：
- 报废申请创建
- 申请撤回
- 审批通过/驳回
- 资产状态变更

Author: SWARM-002 Team
Created: 2025-01-15
"""

from django.db import models
from django.utils import timezone


class RetirementHistory(models.Model):
    """
    资产退役历史记录
    
    记录资产从正常状态到退役状态的全流程操作历史，
    包括申请提交、审批处理、状态变更等关键节点。
    
    Attributes:
        asset: 关联的资产实例
        application: 关联的报废申请单（非必填，状态变更可能无申请）
        action: 操作类型
        previous_status: 变更前的资产状态
        new_status: 变更后的资产状态
        performed_by: 执行操作的用户
        comment: 操作备注/审批意见
        created_at: 记录创建时间
    """
    
    ACTION_CHOICES = [
        ('created', '申请创建'),
        ('withdrawn', '申请撤回'),
        ('approved', '审批通过'),
        ('rejected', '审批驳回'),
        ('status_changed', '状态变更'),
    ]
    
    STATUS_DISPLAY_MAP = {
        'normal': '正常',
        'pending_retirement': '待退役',
        'retired': '已退役',
        'pending': '待审批',
        'draft': '草稿',
        'approved': '已通过',
        'rejected': '已驳回',
        'withdrawn': '已撤回',
    }
    
    id = models.BigAutoField(
        primary_key=True,
        verbose_name='记录ID'
    )
    
    asset = models.ForeignKey(
        'Asset',
        on_delete=models.CASCADE,
        related_name='retirement_histories',
        verbose_name='资产',
        help_text='关联的资产记录'
    )
    
    application = models.ForeignKey(
        'RetirementApplication',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='histories',
        verbose_name='报废申请单',
        help_text='关联的报废申请单，部分操作可能无申请'
    )
    
    action = models.CharField(
        '操作类型',
        max_length=20,
        choices=ACTION_CHOICES,
        db_index=True,
        help_text='操作类型：created/withdrawn/approved/rejected/status_changed'
    )
    
    previous_status = models.CharField(
        '变更前状态',
        max_length=20,
        null=True,
        blank=True,
        help_text='资产变更前的状态'
    )
    
    new_status = models.CharField(
        '变更后状态',
        max_length=20,
        null=True,
        blank=True,
        help_text='资产变更后的状态'
    )
    
    performed_by = models.ForeignKey(
        'User',
        on_delete=models.PROTECT,
        related_name='retirement_actions',
        verbose_name='执行人',
        help_text='执行此操作的用户'
    )
    
    comment = models.TextField(
        '备注',
        blank=True,
        default='',
        help_text='操作备注或审批意见'
    )
    
    created_at = models.DateTimeField(
        '创建时间',
        auto_now_add=True,
        db_index=True,
        help_text='记录创建时间'
    )
    
    # 元数据字段
    metadata = models.JSONField(
        '扩展数据',
        null=True,
        blank=True,
        help_text='用于存储额外的操作上下文信息'
    )
    
    # 软删除标记
    is_deleted = models.BooleanField(
        '已删除',
        default=False,
        db_index=True,
        help_text='软删除标记，历史记录不可删除'
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = '退役历史'
        verbose_name_plural = '退役历史记录'
        indexes = [
            models.Index(fields=['asset', '-created_at']),
            models.Index(fields=['action', '-created_at']),
            models.Index(fields=['performed_by', '-created_at']),
        ]
        # 历史记录不允许物理删除
        managed = True
        db_table = 'retirement_history'
    
    def __str__(self):
        """返回操作记录的字符串表示"""
        action_display = dict(self.ACTION_CHOICES).get(self.action, self.action)
        asset_code = self.asset.asset_code if self.asset else 'N/A'
        return f"{asset_code} - {action_display} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"
    
    def save(self, *args, **kwargs):
        """保存前验证"""
        if not self.performed_by:
            raise ValueError("执行人不能为空")
        super().save(*args, **kwargs)
    
    @property
    def previous_status_display(self):
        """获取变更前状态的中文显示"""
        return self.STATUS_DISPLAY_MAP.get(self.previous_status, self.previous_status)
    
    @property
    def new_status_display(self):
        """获取变更后状态的中文显示"""
        return self.STATUS_DISPLAY_MAP.get(self.new_status, self.new_status)
    
    @property
    def action_display(self):
        """获取操作类型的中文显示"""
        return dict(self.ACTION_CHOICES).get(self.action, self.action)
    
    @classmethod
    def log_created(cls, asset, application, user, comment=''):
        """
        记录申请创建操作
        
        Args:
            asset: 资产实例
            application: 报废申请单
            user: 申请人
            comment: 备注
        
        Returns:
            RetirementHistory: 创建的历史记录
        """
        return cls.objects.create(
            asset=asset,
            application=application,
            action='created',
            previous_status='normal',
            new_status='pending_retirement',
            performed_by=user,
            comment=comment
        )
    
    @classmethod
    def log_withdrawn(cls, asset, application, user, comment=''):
        """
        记录申请撤回操作
        
        Args:
            asset: 资产实例
            application: 报废申请单
            user: 撤回人
            comment: 备注
        
        Returns:
            RetirementHistory: 创建的历史记录
        """
        return cls.objects.create(
            asset=asset,
            application=application,
            action='withdrawn',
            previous_status='pending_retirement',
            new_status='normal',
            performed_by=user,
            comment=comment
        )
    
    @classmethod
    def log_approved(cls, asset, application, user, comment=''):
        """
        记录审批通过操作
        
        Args:
            asset: 资产实例
            application: 报废申请单
            user: 审批人
            comment: 审批意见
        
        Returns:
            RetirementHistory: 创建的历史记录
        """
        return cls.objects.create(
            asset=asset,
            application=application,
            action='approved',
            previous_status='pending_retirement',
            new_status='retired',
            performed_by=user,
            comment=comment
        )
    
    @classmethod
    def log_rejected(cls, asset, application, user, comment=''):
        """
        记录审批驳回操作
        
        Args:
            asset: 资产实例
            application: 报废申请单
            user: 审批人
            comment: 驳回原因
        
        Returns:
            RetirementHistory: 创建的历史记录
        """
        return cls.objects.create(
            asset=asset,
            application=application,
            action='rejected',
            previous_status='pending_retirement',
            new_status='normal',
            performed_by=user,
            comment=comment
        )
    
    @classmethod
    def log_status_change(cls, asset, previous_status, new_status, user, comment='', metadata=None):
        """
        记录状态变更操作
        
        Args:
            asset: 资产实例
            previous_status: 变更前状态
            new_status: 变更后状态
            user: 执行人
            comment: 备注
            metadata: 扩展数据
        
        Returns:
            RetirementHistory: 创建的历史记录
        """
        return cls.objects.create(
            asset=asset,
            application=None,
            action='status_changed',
            previous_status=previous_status,
            new_status=new_status,
            performed_by=user,
            comment=comment,
            metadata=metadata
        )