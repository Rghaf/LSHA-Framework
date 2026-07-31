export default function InputLabel({ title, description, type }) {
  return (
    <>
      <label
        htmlFor={title}
        className={`${
          type === "number" ? "block" : ""
        } font-medium text-gray-700 dark:text-gray-200 ${
          type === "select" ? "text-xl" : "text-xl"
        }`}>
        {title}
      </label>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </>
  );
}
