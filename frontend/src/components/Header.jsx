import { useContext } from "react";
import { Link } from "react-router-dom";
import { FaMoon } from "@react-icons/all-files/fa/FaMoon";
import { FaSun } from "@react-icons/all-files/fa/FaSun";
import { ThemeContext } from "../contexts/ThemeContext";

export default function Header() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  return (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-50">
      <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <Link
            to="/"
            className="text-4xl font-extrabold text-blue-700 dark:text-blue-400 tracking-tight">
            POLMI
          </Link>
          <span className="ml-2 text-xl font-medium text-gray-600 dark:text-gray-300">
            L*sha Framework
          </span>
        </div>
        <div className="flex items-center space-x-8">
          <Link
            to="/case-studies"
            className="text-lg font-medium text-gray-600 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400 transition-colors duration-200">
            Case Studies
          </Link>
          <a
            href="#"
            className="text-lg font-medium text-gray-600 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400 transition-colors duration-200">
            Documents
          </a>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center gap-2 text-lg font-medium text-gray-600 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400 transition-colors duration-200 cursor-pointer">
            {isDark ? (
              <FaSun className="h-5 w-5" />
            ) : (
              <FaMoon className="h-5 w-5" />
            )}
            <span className="hidden sm:inline">
              {isDark ? "Light Mode" : "Dark Mode"}
            </span>
          </button>
          <a
            href="#"
            className="text-lg font-medium text-gray-600 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400 transition-colors duration-200">
            GitHub
          </a>
        </div>
      </nav>
    </header>
  );
}
