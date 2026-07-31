export default function Number({
  title,
  value,
  placeholder,
  min,
  max,
  handleChange,
}) {
  return (
    <input
      type="number"
      onChange={handleChange}
      id={title}
      value={value}
      name={title}
      placeholder={placeholder}
      min={min}
      max={max}
      className="mt-1 block w-full px-4 py-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-lg"
      //   value="75"
    />
  );
}
