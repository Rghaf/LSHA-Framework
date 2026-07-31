const STATUS_STYLES = {
  PENDING: "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300",
  RUNNING: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  CANCELLED: "bg-gray-200 text-gray-700 dark:bg-slate-600 dark:text-gray-200",
};

const STATUS_LABELS = {
  PENDING: "Pending",
  RUNNING: "Running",
  COMPLETED: "Successful",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export default function StatusBadge({ status }) {
  const key = STATUS_STYLES[status] ? status : "PENDING";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[key]}`}>
      {STATUS_LABELS[key]}
    </span>
  );
}
