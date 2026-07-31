// filepath: /home/rghaf/Projects/lsha-react/src/components/inputs/EventFields.jsx
import { useContext } from "react";
import Input from "./Input";
import Button from "../Button";
import { MdDeleteForever } from "@react-icons/all-files/md/MdDeleteForever";
import { CustomCsContext } from "../../contexts/CustomCsContext";

export default function AddMultipleFields({
  index,
  fields = [
    { key: "channel", title: "Channel", type: "text", description: "name" },
    { key: "condition", title: "Condition", type: "text" },
    { key: "symbol", title: "Symbol", type: "text" },
  ],
  options,
  item = {},
  handleChange,
  handleRemove,
}) {
  const { customCsDispatch } = useContext(CustomCsContext);

  return (
    <div className="flex justify-between gap-2">
      {fields.map(({ key, title, type, description }) => (
        <div key={key} className="m-1 flex-1">
          <Input
            title={title}
            description={description}
            type={type}
            options={options}
            value={item[key] ?? ""}
            handleChange={(e) => handleChange(index, key, e.target.value)}
          />
        </div>
      ))}

      <div className="mt-8">
        <Button
          handleClick={() => handleRemove(index)}
          text="Remove"
          icon={<MdDeleteForever />}
          classes="bg-red-500 text-white mt-1 hover:bg-red-700"
        />
      </div>
    </div>
  );
}
