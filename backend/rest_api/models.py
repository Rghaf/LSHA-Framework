from django.db import models

# Create your models here.
class CaseStudy(models.Model):
    id = models.AutoField(primary_key=True)
    created_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=200)
    email = models.CharField(max_length=100, null=True, blank=True)
    resample_strategy = models.CharField(max_length=100, default='UPPAAL')
    # Progress tracking for the async Celery learning task. `current_step`
    # is one of the TRACE_GENERATION/BUILDING_MODEL/LEARNING/SAVING_RESULTS
    # keys the task writes at each phase boundary (see core_algorithm/tasks.py);
    # null while PENDING or once the task reaches a terminal status.
    status = models.CharField(max_length=32, default='PENDING')
    current_step = models.CharField(max_length=64, null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    # Celery AsyncResult id for the in-flight learning task, saved right
    # after `.delay()` in core_algorithm/views.py — needed so the cancel
    # endpoint can revoke() the correct task.
    task_id = models.CharField(max_length=255, null=True, blank=True)
    uppaal_model_file = models.FileField(upload_to='uploads/uppaal/models', null=True, blank=True)
    uppaal_query_file = models.FileField(upload_to='uploads/uppaal/queries', null=True, blank=True)
    # csv_file = models.FileField(upload_to='uploads/csv/files', null=True, blank=True)
    driver_signal = models.JSONField(default=list, null=True, blank=True)
    # uppaal_query = models.JSONField(null=True, blank=True, default=dict)
    main_variable = models.CharField(max_length=100, null=True, blank=True, default='')
    context_variables = models.JSONField(null=True, blank=True, default=list)
    user_json = models.JSONField(null=True, blank=True)
    noise = models.FloatField(default=0.0)
    n_min = models.IntegerField(null = True, blank = True, default = 10)
    p_value = models.FloatField(default=0.05)
    mi_query = models.BooleanField(default=False)
    plot_ddtw = models.BooleanField(default=False)
    ht_query = models.BooleanField(default=False)
    ht_query_type = models.CharField(max_length=100, null=True, blank=True)
    eq_condition = models.CharField(max_length=100, null=True, blank=True)
    is_aggregation = models.BooleanField(null = True, blank = True, default = False)
    final_result_txt = models.FileField(upload_to='results/final_results', null=True, blank=True)
    final_result_pdf = models.FileField(upload_to='results/final_results', null=True, blank=True)

    def __str__(self):
        # If name exists, return it. If not, return a placeholder with the ID.
        if self.name:
            return self.name
        return f"Unnamed List (ID: {self.id})"

class CsvFile(models.Model):
    id = models.AutoField(primary_key=True)
    created_at = models.DateTimeField(auto_now_add=True)
    file = models.FileField(upload_to='uploads/csv/files')
    case_study = models.ForeignKey(CaseStudy, on_delete=models.CASCADE, related_name='csv_files')

    def __str__(self):
        return f"CSV file {self.id} for case study {self.case_study.name} - {self.case_study.id}"

