import InputLabel from "../InputLabel";
import CheckBox from "./Checkbox";

import Number from "./Number";
import Select from "./Select";
import File from "./File";
import Text from "./Text";
import Json from "./Json";

export default function Input({
  title,
  description,
  type,
  value,
  options,
  placeholder,
  disabled = false,
  required = false,
  multiple = false,
  handleChange,
  onFileSelect,
  accept,
  min,
  max,
  checked,
}) {
  const divClassName = "";

  let content;

  if (type === "text") {
    content = (
      <Text
        title={title}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        handleChange={handleChange}
        required={required}
      />
    );
  } else if (type === "checkbox") {
    content = (
      <CheckBox title={title} handleChange={handleChange} checked={checked} />
    );
  } else if (type === "number") {
    content = (
      <Number
        title={title}
        value={value}
        placeholder={placeholder}
        min={min}
        max={max}
        handleChange={handleChange}
      />
    );
  } else if (type === "select" || type === "select-rs") {
    content = (
      <Select
        options={options}
        title={title}
        value={value}
        type={type}
        multiple={multiple}
        handleChange={handleChange}
      />
    );
  } else if (type === "file") {
    content = (
      <File
        title={title}
        accept={accept}
        onFileSelect={onFileSelect}
        max={max}
        multiple={multiple}
        value={value}
      />
    );
  } else if (type === "json") {
    content = (
      <Json
        title={title}
        handleChange={handleChange}
        value={value}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div className={divClassName}>
      {type === "checkbox" ? (
        <>
          <div className="flex items-center justify-between">
            <InputLabel title={title} type={type} />
            <div>{content}</div>
          </div>
          <div>
            {description && (
              <div className="text-sm text-gray-500">{description}</div>
            )}
          </div>
        </>
      ) : (
        <>
          <InputLabel title={title} description={description} type={type} />
          {content}
        </>
      )}
      {/* <span className="text-sm text-red-600">asdads</span> */}
    </div>
  );
}
