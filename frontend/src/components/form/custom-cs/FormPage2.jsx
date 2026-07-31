import { useContext, useEffect, useState, useCallback } from "react";
import { MdAdd } from "@react-icons/all-files/md/MdAdd";
import { CustomCsContext } from "../../../contexts/CustomCsContext";
import { PageContext } from "../../../contexts/PageContext";
import Button from "../../Button";
import Input from "../../inputs/Input";

export default function FormPage2({ handleBtnDisabled }) {
  const [variables, setVariables] = useState([]);
  const { customCsState, customCsDispatch } = useContext(CustomCsContext);
  const { pageState } = useContext(PageContext);
  const variableOptions =
    customCsState.resampleStrategy === "UPPAAL"
      ? customCsState.uppaalQuery?.variables || []
      : customCsState.resampleStrategy === "SIM"
        ? customCsState.csvHeaders || []
        : [];

  useEffect(() => {
    // Require at least one real driver signal — an empty array (e.g. the
    // user selected then deselected everything) is not null and would
    // otherwise slip past this check and submit a case study with no
    // driver signal, silently breaking the learning run.
    const hasDriverSignal =
      Array.isArray(customCsState.driverSignal) &&
      customCsState.driverSignal.length > 0;
    const hasMainVariable =
      Boolean(customCsState.mainVariable) &&
      customCsState.mainVariable !== "----please select an option----";
    handleBtnDisabled(hasDriverSignal && hasMainVariable);
  }, [customCsState]);

  function handleDriverSignal(e) {
    // 1. Get all selected options from the multiple select
    const selectedOptions = Array.from(
      e.target.selectedOptions,
      (option) => option.value,
    );

    // 2. Filter out placeholder and restore original case
    const values = selectedOptions
      .filter((val) => val !== "----please select one or more options----")
      .map((val) => {
        const original = variableOptions.find((v) => v === val);
        return original || val;
      });

    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "driverSignal", value: values },
    });
  }

  function handleMainVariable(e) {
    const value = e.target.value;
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "mainVariable", value },
    });
  }

  function handleContextVariables(e) {
    // 1. Get all selected options from the multiple select
    const selectedOptions = Array.from(
      e.target.selectedOptions,
      (option) => option.value,
    );

    // 2. Filter out placeholder and restore original case
    const values = selectedOptions
      .filter((val) => val !== "----please select one or more options----")
      .map((val) => {
        const original = variableOptions.find((v) => v === val);
        return original || val;
      });

    // 3. Update state with array of strings
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "contextVariables", value: values },
    });
  }

  // function addVariableRow() {
  //   customCsDispatch({
  //     type: "ADD_VAR_UPPAAL",
  //     payload: { value: "" },
  //   });
  // }

  return (
    <>
      <Input
        type="select"
        title="Driver Signal"
        multiple={true}
        description="The trigger or action that changes the system's state."
        options={[
          "----please select one or more options----",
          ...variableOptions,
        ]}
        value={
          Array.isArray(customCsState.driverSignal)
            ? customCsState.driverSignal
            : []
        }
        handleChange={(e) => handleDriverSignal(e)}
      />
      {/* <Button
        text="Add more"
        // handleClick={addVariableRow}
        icon={<MdAdd />}
        classes="text-white bg-blue-600 hover:bg-blue-700 hover:scale-101"
      /> */}
      <Input
        type="select"
        title="Main Variable"
        description="The main physical value being tracked and modeled."
        options={["----please select an option----", ...variableOptions]}
        value={customCsState.mainVariable ?? ""}
        handleChange={(e) => handleMainVariable(e)}
      />
      <Input
        type="select"
        title="Context Variable"
        description="Background conditions that affect the environment."
        multiple={true}
        options={[
          "----please select one or more options----",
          ...variableOptions,
        ]}
        value={
          Array.isArray(customCsState.contextVariables)
            ? customCsState.contextVariables
            : []
        }
        handleChange={(e) => handleContextVariables(e)}
      />
    </>
  );
}
