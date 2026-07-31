import { useContext, useEffect, useState } from "react";
import { PageContext } from "../../../contexts/PageContext";
import { CustomCsContext } from "../../../contexts/CustomCsContext";
import Input from "../../inputs/Input";
import Alert from "../../Alert";

export default function FormPage3({ handleBtnDisabled }) {
  const [addManual, setAddManual] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");
  const { customCsState, customCsDispatch } = useContext(CustomCsContext);
  const { pageState, pageDispatch, loadingOn, loadingOff } =
    useContext(PageContext);

  useEffect(() => {
    if (customCsState.userJson) {
      setJsonInput(customCsState.userJson);
    } else setJsonInput("");
  }, [customCsState.userJson]);

  useEffect(() => {
    if (jsonInput.trim() === "") {
      handleBtnDisabled(false);
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      setJsonError("");
      handleBtnDisabled(true);
    } catch (err) {
      setJsonError(err.message);
      handleBtnDisabled(false);
    }
  }, [jsonInput, customCsState]);

  function handleJsonChange(e) {
    setJsonInput(e.target.value);
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "userJson", value: e.target.value },
    });
  }

  return (
    <>
      <div className="mb-4">
        <Input
          title="Events JSON Input"
          type="json"
          value={jsonInput}
          handleChange={handleJsonChange}
          placeholder={`[\n  {\n    "channel": "channel1",\n    "condition": "x > 5",\n    "symbol": "event1"\n  }\n]`}
        />
        {jsonError && <Alert text={`Invalid JSON!`} type="danger" />}
      </div>
    </>
  );
}
