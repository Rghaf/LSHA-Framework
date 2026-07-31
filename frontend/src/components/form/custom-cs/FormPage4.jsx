import { useContext, useEffect, useState, useCallback } from "react";
import { MdAdd } from "@react-icons/all-files/md/MdAdd";
import { CustomCsContext } from "../../../contexts/CustomCsContext";
import { PageContext } from "../../../contexts/PageContext";
import Button from "../../Button";
import Input from "../../inputs/Input";

export default function FormPage4({ handleBtnDisabled }) {
  const [variables, setVariables] = useState([]);
  const { customCsState, customCsDispatch } = useContext(CustomCsContext);
  const { pageState } = useContext(PageContext);

  // useEffect(() => {

  // }, [])

  function handleNoise(e) {
    const value = e.target.value;
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "noise", value },
    });
  }

  function handleNMin(e) {
    const value = e.target.value;
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "nMin", value },
    });
  }

  function handlePValue(e) {
    const value = e.target.value;
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "pValue", value },
    });
  }

  function handleMiQuery(e) {
    const value = e.target.checked;
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "miQuery", value },
    });
  }

  function handlePlotDdtw(e) {
    const value = e.target.checked;
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "plotDdtw", value },
    });
  }

  function handleHtQuery(e) {
    const value = e.target.checked;
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "htQuery", value },
    });
  }

  function handleHtQueryType(e) {
    const value = e.target.value;
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "htQueryType", value },
    });
  }

  function handleEqCondition(e) {
    const value = e.target.value;
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "eqCondition", value },
    });
  }

  // function handleIsStochastic(e) {
  //   const value = e.target.checked;
  //   console.log("IS STOCHASTIC VALUE:", value);
  //   console.log(value);
  //   customCsDispatch({
  //     type: "UPDATE_FIELD",
  //     payload: { key: "isStochastic", value },
  //   });
  // }

  function handleIsAggregation(e) {
    const value = e.target.checked;
    console.log("IS Aggregation VALUE:", value);
    console.log(value);
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "isAggregation", value },
    });
  }

  return (
    <>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-8">
        <div className="flex flex-col gap-8">
          <Input
            type="number"
            title="Noise"
            description="The expected amount of random error"
            value={customCsState.noise ?? ""}
            handleChange={(e) => handleNoise(e)}
          />
          <Input
            type="select"
            title="HT Query Type"
            description="How the math is tested, Deterministic or Stochastic"
            options={["D", "S"]}
            value={customCsState.htQueryType ?? ""}
            handleChange={(e) => handleHtQueryType(e)}
          />
          <Input
            type="checkbox"
            title="MI Query"
            description="A switch to enable learning the actual physics curves"
            checked={customCsState.miQuery ?? false}
            handleChange={(e) => handleMiQuery(e)}
          />

          <Input
            type="checkbox"
            title="Plot DDTW"
            description="An option to generate visual graphs"
            checked={customCsState.plotDdtw ?? false}
            handleChange={(e) => handlePlotDdtw(e)}
          />
        </div>

        <div className="w-px bg-gray-300 dark:bg-slate-600"></div>

        <div className="flex flex-col gap-8">
          <Input
            type="number"
            title="P-value"
            description="The statistical confidence level."
            value={customCsState.pValue ?? ""}
            handleChange={(e) => handlePValue(e)}
          />

          <Input
            type="select"
            title="Eq Condition"
            description="How strictly the algorithm compares two states"
            options={["S", "W"]}
            value={customCsState.eqCondition ?? ""}
            handleChange={(e) => handleEqCondition(e)}
          />

          <Input
            type="checkbox"
            title="HT Query"
            description="Tests if new physical data fits known patterns."
            checked={customCsState.htQuery ?? false}
            handleChange={(e) => handleHtQuery(e)}
          />
          <Input
            type="checkbox"
            title="Is Aggregation"
            description="Tells the algorithm that the data comes from a messy real-world environment with random variations"
            checked={customCsState.isAggregation ?? false}
            handleChange={(e) => handleIsAggregation(e)}
          />
        </div>
      </div>
      <Input
        type="number"
        title="N min"
        description="The expected amount of random error"
        value={customCsState.nMin ?? 10}
        handleChange={(e) => handleNMin(e)}
      />
    </>
  );
}
