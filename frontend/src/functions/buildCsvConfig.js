// Bridges FormPage1's CSV-shape settings (csvFormat/csvFieldColumn/...) into
// the trace_generation.csv JSON block the backend actually reads (see
// backend/core_algorithm/dynamic_sul.py's _resolve_csv_config). FormPage3's
// JSON textarea has no other connection to what was uploaded/configured in
// Step 1 — without this, a user would have to hand-type this block exactly
// right with no validation that it matches their files.

function defaultSkeleton() {
  return {
    variables: [],
    models: [],
    events: [],
    constants: {},
    trace_generation: {},
  };
}

export function buildCsvConfigBlock(state) {
  const format = state.csvFormat === "long" ? "long" : "wide";
  const block = { wide_or_long: format };
  if (format === "long") {
    block.field_column = state.csvFieldColumn || "DataObjectField";
    block.value_column = state.csvValueColumn || "Value";
    block.timestamp_column = state.csvTimestampColumn || "TimeStamp";
    // Multiple long-format files (e.g. GREEN's REAL + BOOL split) cover the
    // same time window but carry different signals — they must be merged
    // into a single trace, not treated as separate traces. Without this,
    // the backend parses each uploaded CSV independently and each one is
    // still missing the other file's columns (see core_algorithm/tasks.py's
    // bundle_all_csv handling).
    block.bundle_all_csv = true;
  }
  return block;
}

export function buildSkeletonUserJson(state) {
  const skeleton = defaultSkeleton();
  skeleton.trace_generation = {
    strategy: "CSV",
    csv: buildCsvConfigBlock(state),
  };
  return JSON.stringify(skeleton, null, 2);
}

// Merges just the CSV-related sub-keys into whatever the user already typed,
// preserving variables/models/events/constants and any advanced keys already
// present under trace_generation.csv (column_remap, round_columns,
// filter_object, etc. stay untouched).
export function mergeCsvConfigIntoUserJson(existingJsonText, state) {
  let parsed;
  try {
    parsed =
      existingJsonText && existingJsonText.trim()
        ? JSON.parse(existingJsonText)
        : null;
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    parsed = defaultSkeleton();
  }
  if (
    !parsed.trace_generation ||
    typeof parsed.trace_generation !== "object" ||
    Array.isArray(parsed.trace_generation)
  ) {
    parsed.trace_generation = {};
  }
  if (!parsed.trace_generation.strategy) {
    parsed.trace_generation.strategy = "CSV";
  }
  const existingCsv =
    parsed.trace_generation.csv &&
    typeof parsed.trace_generation.csv === "object" &&
    !Array.isArray(parsed.trace_generation.csv)
      ? parsed.trace_generation.csv
      : {};
  parsed.trace_generation.csv = {
    ...existingCsv,
    ...buildCsvConfigBlock(state),
  };
  return JSON.stringify(parsed, null, 2);
}
