from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from lsha_web import celery_app
from .models import CaseStudy, CsvFile
from .serializers import CaseStudyListSerializer, CaseStudySerializer, CsvFileSerializer

CANCELLABLE_STATUSES = ('PENDING', 'RUNNING')


class CaseStudyPagination(PageNumberPagination):
    page_size = 20


class CaseStudyViewSet(viewsets.ModelViewSet):
    queryset = CaseStudy.objects.all().order_by('-created_at')
    serializer_class = CaseStudySerializer
    permission_classes = [AllowAny]
    pagination_class = CaseStudyPagination

    def get_serializer_class(self):
        if self.action == 'list':
            return CaseStudyListSerializer
        return CaseStudySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(email__icontains=search)
            )
        return queryset

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Stop an in-flight learning run (POST /api/case-study/<id>/cancel/).

        Marks the row CANCELLED first, then revokes the Celery task —
        that order matters: once revoke(terminate=True) lands, the worker
        process executing the task is force-killed and can't run its own
        cleanup/except-block DB writes, so the status update can't rely on
        the task itself to happen. See dynamic_tracegenerator.py for how a
        UPPAAL subprocess in flight at that moment is also killed rather
        than left orphaned.
        """
        cs = self.get_object()
        if cs.status not in CANCELLABLE_STATUSES:
            return Response(
                {"error": f"Cannot cancel a case study with status '{cs.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cs.status = 'CANCELLED'
        cs.current_step = None
        cs.error_message = 'Cancelled by user.'
        cs.save(update_fields=['status', 'current_step', 'error_message'])

        if cs.task_id:
            celery_app.control.revoke(cs.task_id, terminate=True, signal='SIGTERM')

        return Response(CaseStudySerializer(cs, context={'request': request}).data)

class CsvFileViewSet(viewsets.ModelViewSet):
    queryset = CsvFile.objects.all()
    serializer_class = CsvFileSerializer
    permission_classes = [AllowAny]