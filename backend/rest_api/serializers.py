from rest_framework import serializers

from .models import CaseStudy, CsvFile

class CsvFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CsvFile
        fields = '__all__'
        read_only_fields = ['id']


class CaseStudySerializer(serializers.ModelSerializer):
    # Reverse FK — not a model field, so it needs to be declared explicitly
    # even under fields = '__all__'. Without this the detail page has no way
    # to see which CSVs (SIM/CSV strategy) were uploaded for a case study.
    csv_files = CsvFileSerializer(many=True, read_only=True)

    class Meta:
        model = CaseStudy
        fields = '__all__'
        read_only_fields = ['id']

    def to_internal_value(self, data):
        if data.get('context_variables') == '':
            data = data.copy()
            data['context_variables'] = []
        return super().to_internal_value(data)

class CaseStudyListSerializer(serializers.ModelSerializer):
    """Lean shape for the paginated case-study list — the detail page (and
    the create/update flows) still use the full CaseStudySerializer."""
    class Meta:
        model = CaseStudy
        fields = ['id', 'name', 'email', 'resample_strategy', 'created_at', 'status']


# class EventsSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Event
#         fields = '__all__'
#         read_only_fields = ['id']