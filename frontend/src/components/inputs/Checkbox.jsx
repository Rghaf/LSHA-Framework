export default function CheckBox({ title, handleChange, checked }) {
  return (
    <label className="toggle-switch relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        onChange={handleChange}
        checked={checked}
        // value="true"
        id={title}
        name={title}
        className="sr-only peer"
      />
      <div className="slider w-14 h-8 bg-gray-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all duration-300 peer-checked:bg-blue-500"></div>
    </label>
  );
}
