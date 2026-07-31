import { useContext, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { CustomCsContext } from "../contexts/CustomCsContext";
import { mapCaseStudyJson } from "../functions/mapCaseStudyJson";

export default function UploadBox() {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const { customCsDispatch } = useContext(CustomCsContext);
  const navigate = useNavigate();

  function processFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.error("Please upload a .json case-study file.", {
        theme: "colored",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      let parsed;
      try {
        parsed = JSON.parse(e.target.result || "");
      } catch (err) {
        toast.error(`Invalid JSON: ${err.message}`, { theme: "colored" });
        return;
      }

      const { ok, data, error } = mapCaseStudyJson(parsed);
      if (!ok) {
        toast.error(`Invalid case study JSON: ${error}`, { theme: "colored" });
        return;
      }

      // Bulk-load the parsed fields into the shared case-study state, then move
      // the user into the upload wizard to collect data files and review.
      customCsDispatch({ type: "CREATED", payload: data });
      toast.success(`Loaded "${data.name}". Let's add the data files.`, {
        theme: "colored",
      });
      navigate("/upload");
    };
    reader.onerror = () => {
      toast.error("Could not read the file.", { theme: "colored" });
    };
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl h-60 flex items-center justify-center p-6 transition-all duration-300 cursor-pointer ${
        isDragging
          ? "border-blue-500 bg-blue-50 dark:bg-slate-700 dark:border-blue-400"
          : "bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700"
      }`}>
      <div className="text-center pointer-events-none">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <h3 className="mt-2 text-2xl font-semibold text-gray-700 dark:text-gray-200">
          Drag and drop your case-study JSON here
        </h3>
        <p className="mt-1 text-lg text-gray-500 dark:text-gray-400">
          or{" "}
          <span className="text-blue-600 dark:text-blue-400 pointer-events-auto hover:underline">
            browse
          </span>{" "}
          to upload a <code>.json</code> file
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => processFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
