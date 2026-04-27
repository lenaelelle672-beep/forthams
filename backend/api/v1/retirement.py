from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from backend.models.asset import Asset
from backend.models.retirement import RetirementApplication, RetirementHistory
from backend.models.user import User
from backend.api.v1.serializers.retirement import (
    RetirementApplicationSerializer,
    RetirementHistorySerializer,
)
from backend.services.retirement import RetirementService
from backend.exceptions import InvalidStatusError, ConflictError, PermissionDeniedError


class RetirementApplicationViewSet(viewsets.ModelViewSet):
    """
    报废申请管理
    """
    serializer_class = RetirementApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.action in ['list', 'retrieve']:
            if self.request.user.role == 'admin':
                return RetirementApplication.objects.all()
            return RetirementApplication.objects.filter(applicant=self.request.user)
        return RetirementApplication.objects.none()

    def perform_create(self, serializer):
        """创建申请时自动设置申请人"""
        serializer.save(applicant=self.request.user)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        """撤回申请"""
        application = self.get_object()
        if application.applicant != request.user:
            return Response({'error': '无权限操作'}, status=status.HTTP_403_FORBIDDEN)
        if application.status != 'pending':
            return Response({'error': '仅待审批状态可撤回'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            RetirementService.withdraw(application, request.user)
            return Response(RetirementApplicationSerializer(application).data)
        except InvalidStatusError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ApprovalViewSet(viewsets.ViewSet):
    """
    审批处理（管理员专用）
    """
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['approve', 'reject']:
            return [permission() for permission in [IsAuthenticated, IsAdminRole]]
        return super().get_permissions()

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """审批通过"""
        try:
            application = RetirementApplication.objects.get(pk=pk)
            comment = request.data.get('comment', '')
            asset = RetirementService.approve(application, request.user, comment)
            return Response({'status': 'approved', 'asset_status': asset.status})
        except RetirementApplication.DoesNotExist:
            return Response({'error': '申请不存在'}, status=status.HTTP_404_NOT_FOUND)
        except InvalidStatusError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except ConflictError:
            return Response({'error': '并发冲突，请重试'}, status=status.HTTP_409_CONFLICT)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """审批驳回"""
        try:
            application = RetirementApplication.objects.get(pk=pk)
            comment = request.data.get('comment', '')
            asset = RetirementService.reject(application, request.user, comment)
            return Response({'status': 'rejected', 'asset_status': asset.status})
        except RetirementApplication.DoesNotExist:
            return Response({'error': '申请不存在'}, status=status.HTTP_404_NOT_FOUND)
        except InvalidStatusError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except ConflictError:
            return Response({'error': '并发冲突，请重试'}, status=status.HTTP_409_CONFLICT)


class RetirementHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    退役历史查询
    """
    serializer_class = RetirementHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return RetirementHistory.objects.all()
        return RetirementHistory.objects.filter(
            application__applicant=self.request.user
        )

    @action(detail=False, methods=['get'], url_path='asset/(?P<asset_id>[^/.]+)')
    def by_asset(self, request, asset_id=None):
        """查询指定资产的退役历史"""
        histories = RetirementHistory.objects.filter(asset_id=asset_id)
        serializer = self.get_serializer(histories, many=True)
        return Response(serializer.data)