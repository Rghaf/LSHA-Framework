// Shared case-study submission logic used by both the manual form (FormSubmit)
// and the JSON-upload flow (upload-cs/ReviewStep).
//
// Performs the same three-step sequence the app has always used:
//   1. POST /api/case-study/   (multipart; UPPAAL files ride along here)
//   2. POST /api/csv-files/    (one request per CSV file, for the SIM strategy)
//   3. POST /run/              (triggers the Celery learning task)
//
// Returns the created case study's { id, result }. Throws on failure.

const BASE_URL = "http://127.0.0.1:8000";

// JSON-typed fields may arrive either as an array/object (manual form, mapped
// JSON) or as raw JSON text (the events textarea). Send text as-is, otherwise
// stringify so the backend's JSONField can parse it.
function serializeJsonField(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

// Number input events hand back strings (and can be mid-edit garbage like ""
// or "-"), so this is the one place that guarantees a real, finite number
// reaches the server instead of "NaN"/"" — which the backend's Float/Integer
// fields would otherwise reject or, worse for "NaN", silently accept.
function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function getErrorDetails(response) {
  try {
    return JSON.stringify(await response.json());
  } catch {
    try {
      return await response.text();
    } catch {
      return "No response body";
    }
  }
}

function buildCaseStudyFormData(state) {
  const s = state || {};
  const fd = new FormData();

  fd.append("name", s.name || "");
  fd.append("email", s.email || "");
  fd.append("resample_strategy", s.resampleStrategy || "");
  fd.append("driver_signal", serializeJsonField(s.driverSignal));
  fd.append("main_variable", s.mainVariable || "");
  fd.append("context_variables", serializeJsonField(s.contextVariables));

  // Keep UPPAAL files in the main payload when present.
  if (s.uppaalModelFile) fd.append("uppaal_model_file", s.uppaalModelFile);
  if (s.uppaalQueryFile) fd.append("uppaal_query_file", s.uppaalQueryFile);

  fd.append("user_json", serializeJsonField(s.userJson));
  fd.append("noise", toNumber(s.noise, 0));
  fd.append("p_value", toNumber(s.pValue, 0.05));
  fd.append("mi_query", s.miQuery ?? false);
  fd.append("plot_ddtw", s.plotDdtw ?? false);
  fd.append("ht_query", s.htQuery ?? false);
  fd.append("ht_query_type", s.htQueryType ?? "");
  fd.append("eq_condition", s.eqCondition ?? "");
  fd.append("is_aggregation", s.isAggregation ?? false);
  fd.append("n_min", toNumber(s.nMin, 10));

  return fd;
}

function toCsvArray(csvFile) {
  if (!csvFile) return [];
  if (Array.isArray(csvFile)) return csvFile;
  if (typeof FileList !== "undefined" && csvFile instanceof FileList) {
    return Array.from(csvFile);
  }
  return [csvFile];
}

// The csv-files endpoint's exact field names have varied; try the known
// combinations until one is accepted.
async function uploadSingleCsv(file, caseStudyId) {
  const strategies = [
    { caseKey: "case_study", fileKey: "csv_file" },
    { caseKey: "case_study_id", fileKey: "csv_file" },
    { caseKey: "case_study", fileKey: "file" },
    { caseKey: "case_study_id", fileKey: "file" },
  ];

  const failures = [];
  for (const { caseKey, fileKey } of strategies) {
    const fd = new FormData();
    fd.append(caseKey, caseStudyId);
    fd.append(fileKey, file, file.name);

    const res = await fetch(`${BASE_URL}/api/csv-files/`, {
      method: "POST",
      body: fd,
    });

    if (res.ok) return res.json();
    failures.push(
      `${caseKey}+${fileKey} => HTTP ${res.status}: ${await getErrorDetails(res)}`,
    );
  }

  throw new Error(
    `CSV upload failed for ${file.name}. Tried: ${failures.join(" | ")}`,
  );
}

// Exported so a failed run can be retried from the Results page without
// resubmitting files — it just re-triggers the Celery task for the same id.
export async function runAlgorithm(id) {
  const res = await fetch(`${BASE_URL}/run/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case_study_id: id }),
  });
  if (!res.ok) {
    throw new Error(`Failed to trigger algorithm (HTTP ${res.status})`);
  }
}

// Stops an in-flight run: the backend revokes the Celery task and marks the
// case study CANCELLED. Throws (with the server's message when available) if
// the case study isn't in a cancellable state (e.g. already finished).
export async function cancelCaseStudy(id) {
  const res = await fetch(`${BASE_URL}/api/case-study/${id}/cancel/`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`${await getErrorDetails(res)}`);
  }
  return res.json();
}

export async function submitCaseStudy(state) {
  const s = state || {};

  const res = await fetch(`${BASE_URL}/api/case-study/`, {
    method: "POST",
    body: buildCaseStudyFormData(s),
  });

  if (!res.ok) {
    throw new Error(
      `Case study creation failed (HTTP ${res.status}): ${await getErrorDetails(res)}`,
    );
  }

  const result = await res.json();
  if (!result || !result.id) {
    throw new Error("Server responded, but no case study ID was returned.");
  }

  // Upload CSVs (SIM strategy) before triggering the run.
  for (const file of toCsvArray(s.csvFile)) {
    if (file) await uploadSingleCsv(file, result.id);
  }

  await runAlgorithm(result.id);

  return { id: result.id, result };
}
