import { useContext, useEffect, useState } from "react";
import { PageContext } from "../../../contexts/PageContext";
import { CustomCsContext } from "../../../contexts/CustomCsContext";
import Input from "../../inputs/Input";
import Alert from "../../Alert";
import Button from "../../Button";
import {
  buildSkeletonUserJson,
  mergeCsvConfigIntoUserJson,
} from "../../../functions/buildCsvConfig";

export default function FormPage3({ handleBtnDisabled }) {
  const [addManual, setAddManual] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [seeded, setSeeded] = useState(false);
  const { customCsState, customCsDispatch } = useContext(CustomCsContext);
  const { pageState, pageDispatch, loadingOn, loadingOff } =
    useContext(PageContext);

  useEffect(() => {
    if (customCsState.userJson) {
      setJsonInput(customCsState.userJson);
    } else setJsonInput("");
  }, [customCsState.userJson]);

  // One-time seed: pre-fill the JSON skeleton (including a trace_generation
  // block matching whatever CSV layout was configured on Step 1) so the user
  // isn't starting from a blank textarea with no link to what they uploaded.
  // Guarded by `seeded` rather than an `userJson === null` check so it never
  // re-fires after the user deliberately clears the field.
  useEffect(() => {
    if (seeded) return;
    setSeeded(true);
    if (customCsState.userJson === null || customCsState.userJson === undefined) {
      const seed = buildSkeletonUserJson(customCsState);
      setJsonInput(seed);
      customCsDispatch({
        type: "UPDATE_FIELD",
        payload: { key: "userJson", value: seed },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Re-syncs just the trace_generation.csv block from Step 1's current CSV
  // settings into whatever the user has already typed here — lets them
  // update the layout/column names on Step 1 and pull the change in without
  // losing hand-typed variables/models/events.
  function handleInsertCsvConfig() {
    const merged = mergeCsvConfigIntoUserJson(jsonInput, customCsState);
    setJsonInput(merged);
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "userJson", value: merged },
    });
  }

  return (
    <>
      <div className="mb-4">
        {customCsState.resampleStrategy === "SIM" && (
          <div className="mb-4">
            <Button
              text="Insert/update CSV config from Step 1"
              handleClick={handleInsertCsvConfig}
              classes="text-white bg-blue-600 hover:bg-blue-700"
            />
          </div>
        )}
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
