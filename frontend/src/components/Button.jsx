import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function Button({
  text,
  classes,
  icon,
  handleClick,
  link,
  disabled,
}) {
  useEffect(() => {
    console.log("DISABLE FROM BUTTON", disabled);
  }, []);
  if (link) {
    return (
      <Link
        to={link}
        onClick={handleClick}
        className={`inline-flex items-center justify-center py-4 px-4 my-3 rounded-full shadow-xl transition-all duration-300 text-xl ${
          disabled
            ? "font-bold bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-400"
            : classes
        }`}>
        {text}
        {icon && <span className="mx-2">{icon}</span>}
      </Link>
    );
  }
  return (
    <button
      disabled={disabled}
      onClick={handleClick}
      className={`inline-flex items-center justify-center py-4 px-4 my-3 rounded-full shadow-xl transition-all duration-300 ${
        disabled ? "font-bold bg-gray-200 text-gray-700" : classes
      }`}>
      {text}
      {icon && <span className="mx-2">{icon}</span>}
    </button>
  );
}
