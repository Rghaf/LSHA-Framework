import { useRef, useState } from "react";
import { MdCloudUpload } from "@react-icons/all-files/md/MdCloudUpload";

// Derives the displayed filename(s) straight from the controlling value
// rather than tracking separate local state — otherwise this box keeps
// showing a stale "file selected" name after the parent's value is cleared
// (e.g. a form Reset), since nothing would ever tell local state to update.
function toFileNames(value) {
  if (!value) return [];
  const files = Array.isArray(value) ? value : [value];
  return files.filter(Boolean).map((file) => file.name ?? String(file));
}

export default function File({
  title,
  max = 5,
  onFileSelect,
  accept = ".csv,.json",
  multiple = false,
  value,
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileNames = toFileNames(value);

  function getFiles(fileList) {
    return Array.from(fileList || []);
  }

  function handleFileSelect(files) {
    const selectedFiles = getFiles(files);
    const normalizedFiles = multiple
      ? selectedFiles
      : selectedFiles.slice(0, 1);

    if (normalizedFiles.length === 0) {
      return;
    }

    const invalidFile = normalizedFiles.find(
      (file) => file.size > max * 1024 * 1024,
    );

    if (invalidFile) {
      alert(`File must be smaller than ${max}MB`);
      return;
    }

    onFileSelect?.(multiple ? normalizedFiles : normalizedFiles[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
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

  function handleInputChange(e) {
    handleFileSelect(e.target.files);
  }

  function handleBrowseClick() {
    fileInputRef.current?.click();
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleBrowseClick}
        className={`bg-white dark:bg-slate-800 border-2 border-dashed rounded-xl h-48 flex items-center justify-center p-6 transition-all duration-300 cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-slate-700"
            : "border-gray-300 dark:border-slate-600 hover:border-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700"
        }`}>
        <div className="text-center pointer-events-none">
          {" "}
          <MdCloudUpload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-lg font-semibold text-gray-700 dark:text-gray-200">
            Drag and drop your {title} here
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            or
            <button
              type="button"
              className="text-blue-600 hover:underline ml-1 pointer-events-auto" // Re-enable pointer events for the button text
              onClick={(e) => {
                e.stopPropagation(); // Stop button click from bubbling to div
                handleBrowseClick();
              }}>
              browse
            </button>
            to upload (Max {max}MB)
          </p>
          {fileNames.length > 0 && (
            <div className="mt-2 text-sm text-green-600">
              <p className="font-medium">
                ✓ {fileNames.length} file{fileNames.length > 1 ? "s" : ""}{" "}
                selected
              </p>
              <ul className="mt-1 space-y-1 text-left">
                {fileNames.map((name) => (
                  <li key={name} className="break-all">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <input
            ref={fileInputRef}
            id={title}
            type="file"
            multiple={multiple}
            accept={accept}
            className="sr-only"
            onChange={handleInputChange}
          />
        </div>
      </div>
    </div>
  );
}
