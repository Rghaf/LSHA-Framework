import { MdKeyboardArrowDown } from "@react-icons/all-files/md/MdKeyboardArrowDown";

export default function Select({
  title,
  options,
  value,
  type,
  handleChange,
  multiple,
}) {
  return (
    <div className="relative mt-3">
      <select
        onChange={handleChange}
        id={title}
        value={value}
        name={title}
        multiple={multiple}
        className="block w-full px-5 py-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg appearance-none pr-10 cursor-pointer">
        {/* {type === "select-cs"
          ? options.map((opt, index) => (
              <option key={index} value={opt.toLowerCase()}>
                {opt}
              </option>
            ))
          : options.map((opt, index) => (
              <option key={index} value={opt.toLowerCase()}>
                {opt}
              </option>
            ))} */}
        {options.map((opt, index) => (
          <option key={index} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700 dark:text-gray-300">
        <MdKeyboardArrowDown className="h-5 w-5" />
      </div>
    </div>
  );
}
