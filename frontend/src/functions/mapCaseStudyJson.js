// Maps an uploaded backend-format case-study JSON (snake_case, like
// backend/case_files/thermo_v5.json) into the camelCase fields used by
// CustomCsContext, and validates that the required keys are present.
//
// Returns { ok, data, error }:
//   ok    - boolean
//   data  - the mapped camelCase payload (only when ok)
//   error - a human-readable message (only when !ok)

// snake_case (JSON) -> camelCase (context) for the direct scalar/array fields.
const FIELD_MAP = {
  name: "name",
  email: "email",
  resample_strategy: "resampleStrategy",
  driver_signal: "driverSignal",
  main_variable: "mainVariable",
  context_variables: "contextVariables",
  noise: "noise",
  n_min: "nMin",
  p_value: "pValue",
  mi_query: "miQuery",
  plot_ddtw: "plotDdtw",
  ht_query: "htQuery",
  ht_query_type: "htQueryType",
  eq_condition: "eqCondition",
  is_aggregation: "isAggregation",
  user_json: "userJson",
};

const REQUIRED_KEYS = ["name", "resample_strategy", "user_json"];

export function mapCaseStudyJson(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      error: "The file must contain a single case-study JSON object.",
    };
  }

  const missing = REQUIRED_KEYS.filter((key) => {
    const value = raw[key];
    if (value === undefined || value === null) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    return false;
  });

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    };
  }

  if (typeof raw.user_json !== "object" || Array.isArray(raw.user_json)) {
    return {
      ok: false,
      error: "`user_json` must be an object describing variables/models/events.",
    };
  }

  const data = {};
  for (const [snake, camel] of Object.entries(FIELD_MAP)) {
    if (raw[snake] !== undefined) {
      data[camel] = raw[snake];
    }
  }

  return { ok: true, data };
}

// Given the mapped/context state, report which data files still need to be
// collected before submission, based on the resample strategy.
export function requiresUppaalFiles(resampleStrategy) {
  return String(resampleStrategy || "").toUpperCase() === "UPPAAL";
}
