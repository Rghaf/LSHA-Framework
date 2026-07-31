export default function Json({ title, placeholder, value, handleChange }) {
  return (
    <textarea
      id={title}
      name={title}
      className="w-full h-64 p-4 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
    />
  );
}
