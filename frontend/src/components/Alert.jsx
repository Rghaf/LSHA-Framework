export default function Alert({ text, style = "info", m = "m-5", size }) {
  let alertStyle;

  if (style === "danger")
    alertStyle =
      "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-300 border-red-600";
  if (style === "info")
    alertStyle =
      "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border-blue-600";
  if (style === "success")
    alertStyle =
      "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-300 border-green-600";

  return (
    <div className={`text-center ${m}`}>
      <span
        className={`${size || "text-lg"} ${alertStyle} text-center border-1 rounded-xl border w-sm p-3`}>
        {text}
      </span>
    </div>
  );
}
