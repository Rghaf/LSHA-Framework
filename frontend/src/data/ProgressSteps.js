// Ordered pipeline steps for the LSHA learning task, mirroring the
// `current_step` keys the backend writes in core_algorithm/tasks.py at each
// phase boundary. `min`/`max` bound the progress bar while a step is active —
// a real backend transition moves the floor forward; the UI only ever
// animates within the currently-confirmed range, never past it.

export const PROGRESS_STEPS = [
  {
    key: "TRACE_GENERATION",
    uppaalLabel: "Connecting to UPPAAL & generating traces",
    csvLabel: "Reading uploaded CSV data",
    min: 5,
    max: 25,
  },
  {
    key: "BUILDING_MODEL",
    label: "Building the learning model",
    min: 25,
    max: 50,
  },
  {
    key: "LEARNING",
    label: "Running the L* learning algorithm",
    min: 50,
    max: 90,
  },
  {
    key: "SAVING_RESULTS",
    label: "Rendering the automaton & saving results",
    min: 90,
    max: 99,
  },
];

export function stepLabel(key, resampleStrategy) {
  const def = PROGRESS_STEPS.find((s) => s.key === key);
  if (!def) return null;
  if (def.uppaalLabel && def.csvLabel) {
    return String(resampleStrategy || "").toUpperCase() === "UPPAAL"
      ? def.uppaalLabel
      : def.csvLabel;
  }
  return def.label;
}

export function stepIndex(key) {
  return PROGRESS_STEPS.findIndex((s) => s.key === key);
}

// Returns the [min, max] the progress bar should animate within for the
// given (status, current_step) pair, or null when there's nothing to show
// (a terminal FAILED/CANCELLED state — the caller renders a dedicated view).
export function stepRange(status, currentStep) {
  if (status === "COMPLETED") return { min: 100, max: 100 };
  if (status === "FAILED" || status === "CANCELLED") return null;
  const def = PROGRESS_STEPS.find((s) => s.key === currentStep);
  if (def) return { min: def.min, max: def.max };
  // PENDING (not yet picked up by a worker), or an older row saved before
  // this tracking existed.
  return { min: 0, max: 5 };
}
