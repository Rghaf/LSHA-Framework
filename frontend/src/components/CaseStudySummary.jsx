import { useContext } from "react";
import { CustomCsContext } from "../contexts/CustomCsContext";
import BoolBadge from "./BoolBadge";

// Grouped, human-readable review of the case-study state. Shared by the manual
// form's summary step (FormPage5) and the JSON-upload review step.

const GROUPS = [
  {
    title: "General",
    fields: [
      { key: "name", label: "Case study name" },
      { key: "email", label: "Email" },
      { key: "resampleStrategy", label: "Resample strategy" },
    ],
  },
  {
    title: "Variables",
    fields: [
      { key: "driverSignal", label: "Driver signal" },
      { key: "mainVariable", label: "Main variable" },
      { key: "contextVariables", label: "Context variables" },
    ],
  },
  {
    title: "Data files",
    fields: [
      { key: "uppaalModelFile", label: "UPPAAL model (.xml)" },
      { key: "uppaalQueryFile", label: "UPPAAL query (.q)" },
      { key: "csvFile", label: "CSV file(s)" },
    ],
  },
  {
    title: "Algorithm parameters",
    fields: [
      { key: "noise", label: "Noise" },
      { key: "pValue", label: "P-value" },
      { key: "nMin", label: "N min" },
      { key: "htQueryType", label: "HT query type" },
      { key: "eqCondition", label: "Eq condition" },
      { key: "miQuery", label: "MI query" },
      { key: "plotDdtw", label: "Plot DDTW" },
      { key: "htQuery", label: "HT query" },
      { key: "isAggregation", label: "Is aggregation" },
    ],
  },
  {
    title: "Events model",
    fields: [{ key: "userJson", label: "User JSON", full: true }],
  },
];

function isFileValue(val) {
  return typeof File !== "undefined" && val instanceof File;
}

function formatFile(file) {
  return `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
}

function renderValue(val) {
  if (val === null || val === undefined || val === "") {
    return <span className="text-gray-400 dark:text-gray-500">—</span>;
  }
  if (typeof val === "boolean") return <BoolBadge value={val} />;
  if (isFileValue(val)) return <span>{formatFile(val)}</span>;

  if (Array.isArray(val)) {
    if (val.length === 0) {
      return <span className="text-gray-400 dark:text-gray-500">—</span>;
    }
    if (val.every(isFileValue)) {
      return (
        <ul className="list-disc pl-5 space-y-1">
          {val.map((file, idx) => (
            <li key={`${file.name}-${idx}`}>{formatFile(file)}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {val.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className="rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-3 py-1 text-sm">
            {String(item)}
          </span>
        ))}
      </div>
    );
  }

  if (typeof val === "object") {
    return (
      <pre className="whitespace-pre-wrap break-words text-sm bg-gray-100 dark:bg-slate-900 rounded-lg p-3 overflow-x-auto">
        {JSON.stringify(val, null, 2)}
      </pre>
    );
  }

  // Raw JSON text (events textarea) — pretty-print when parseable.
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return (
          <pre className="whitespace-pre-wrap break-words text-sm bg-gray-100 dark:bg-slate-900 rounded-lg p-3 overflow-x-auto">
            {JSON.stringify(JSON.parse(trimmed), null, 2)}
          </pre>
        );
      } catch {
        /* fall through to plain text */
      }
    }
  }

  return <span>{String(val)}</span>;
}

export default function CaseStudySummary() {
  const { customCsState } = useContext(CustomCsContext);
  const s = customCsState || {};

  return (
    <div className="space-y-8">
      {GROUPS.map((group) => {
        const visible = group.fields.filter((f) => {
          const v = s[f.key];
          return typeof v === "boolean" || (v !== null && v !== undefined);
        });
        if (visible.length === 0) return null;

        return (
          <section
            key={group.title}
            className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
            <h3 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">
              {group.title}
            </h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {visible.map((f) => (
                <div
                  key={f.key}
                  className={f.full ? "md:col-span-2" : undefined}>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {f.label}
                  </dt>
                  <dd className="text-gray-800 dark:text-gray-100 text-lg break-words">
                    {renderValue(s[f.key])}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
