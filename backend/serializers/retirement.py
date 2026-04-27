"""
序列化器 - 资产报废退役模块

包含报废申请与退役历史相关的序列化器。
"""

from rest_framework import serializers
from .models import RetirementApplication, RetirementHistory


class RetirementApplicationSerializer(serializers.ModelSerializer):
    """
    报废申请序列化器

    用于报废申请的序列化和反序列化验证。
    """

    applicant_name = serializers.CharField(
        source='applicant.username',
        read_only=True
    )
    asset_code = serializers.CharField(
        source='asset.asset_code',
        read_only=True
    )
    asset_name = serializers.CharField(
        source='asset.name',
        read_only=True
    )

    class Meta:
        model = RetirementApplication
        fields = [
            'id', 'asset', 'asset_code', 'asset_name',
            'applicant', 'applicant_name', 'reason',
            'expected_date', 'status', 'version',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'applicant', 'status', 'version',
            'created_at', 'updated_at'
        ]


class RetirementHistorySerializer(serializers.ModelSerializer):
    """
    退役历史序列化器

    用于退役历史记录的序列化和反序列化验证。
    """

    performed_by_name = serializers.CharField(
        source='performed_by.username',
        read_only=True
    )
    asset_code = serializers.CharField(
        source='asset.asset_code',
        read_only=True
    )

    class Meta:
        model = RetirementHistory
        fields = [
            'id', 'asset', 'asset_code', 'application',
            'action', 'previous_status', 'new_status',
            'performed_by', 'performed_by_name', 'comment', 'created_at'
        ]