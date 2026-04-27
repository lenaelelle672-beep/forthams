"""
资产报废相关数据模型

包含:
- RetirementApplication: 报废申请单
- RetirementHistory: 资产退役历史记录
"""

from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class RetirementApplication(models.Model):
    """
    报废申请单
    
    用于记录用户提交的资产报废申请，包含申请原因、
    期望退役日期以及审批状态等信息。
    
    Attributes:
        STATUS_CHOICES: 申请状态选项
        asset: 关联的资产（一一对应）
        applicant: 申请人
        reason: 报废原因
        expected_date: 期望退役日期
        status: 申请状态
        version: 版本号（用于乐观锁）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('pending', '待审批'),
        ('approved', '已通过'),
        ('rejected', '已驳回'),
        ('withdrawn', '已撤回'),
    ]
    
    asset = models.OneToOneField(
        'Asset',
        on_delete=models.CASCADE,
        related_name='retirement_application',
        verbose_name='关联资产'
    )
    applicant = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='submitted_applications',
        verbose_name='申请人'
    )
    reason = models.TextField('报废原因')
    expected_date = models.DateField('期望退役日期', null=True, blank=True)
    status = models.CharField(
        '申请状态',
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    version = models.PositiveIntegerField('版本号', default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = '报废申请'
        verbose_name_plural = '报废申请'
    
    def __str__(self):
        return f"{self.asset.asset_code} - {self.status}"


class RetirementHistory(models.Model):
    """
    资产退役历史记录
    
    记录资产退役流程中的所有操作历史，包括申请创建、
    审批通过/驳回、状态变更等操作。
    
    Attributes:
        ACTION_CHOICES: 操作类型选项
        asset: 关联的资产
        application: 关联的申请单
        action: 操作类型
        previous_status: 变更前状态
        new_status: 变更后状态
        performed_by: 操作人
        comment: 备注
        created_at: 创建时间
    """
    
    ACTION_CHOICES = [
        ('created', '申请创建'),
        ('withdrawn', '申请撤回'),
        ('approved', '审批通过'),
        ('rejected', '审批驳回'),
        ('status_changed', '状态变更'),
    ]
    
    asset = models.ForeignKey(
        'Asset',
        on_delete=models.CASCADE,
        related_name='retirement_histories',
        verbose_name='关联资产'
    )
    application = models.ForeignKey(
        RetirementApplication,
        on_delete=models.SET_NULL,
        null=True,
        related_name='histories',
        verbose_name='关联申请'
    )
    action = models.CharField('操作类型', max_length=20, choices=ACTION_CHOICES)
    previous_status = models.CharField('变更前状态', max_length=20, null=True, blank=True)
    new_status = models.CharField('变更后状态', max_length=20, null=True, blank=True)
    performed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        verbose_name='操作人'
    )
    comment = models.TextField('备注', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = '退役历史'
        verbose_name_plural = '退役历史'
    
    def __str__(self):
        return f"{self.asset.asset_code} - {self.action}"