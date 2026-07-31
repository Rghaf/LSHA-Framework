import { useState, useContext, useEffect } from "react";
import { toast } from "react-toastify";
import Input from "../../inputs/Input";
import { CustomCsContext } from "../../../contexts/CustomCsContext";
import { parseUppaalQuery } from "../../../functions/ParseUppaal";
import { parseCSV } from "../../../functions/ParseCSV";

export default function FormPage1({ handleBtnDisabled }) {
  const [touched, setTouched] = useState({});
  const [csName, setCsName] = useState("");
  const [email, setEmail] = useState("");
  const [resampleStrategy, setResampleStrategy] = useState("");
  const [uppaalModelFile, setUppaalModelFile] = useState(null);
  const [uppaalQueryFile, setUppaalQueryFile] = useState(null);
  const [CSVFile, setCSVFile] = useState(null);
  const { customCsState, customCsDispatch } = useContext(CustomCsContext);

  // The set of selectable driver/main/context variables comes from whichever
  // file was last parsed (uppaalQuery.variables or csvHeaders). If the user
  // switches strategy or uploads a different file, any variables they'd
  // already picked on the next step may no longer exist in the new list —
  // the select just stops highlighting them, but the stale names stay in
  // context and would still be submitted. Clear them whenever the variable
  // universe actually changes.
  function resetSelectedVariables() {
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "driverSignal", value: null },
    });
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "mainVariable", value: null },
    });
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "contextVariables", value: null },
    });
  }

  function getFiles(fileOrFiles) {
    return Array.isArray(fileOrFiles)
      ? fileOrFiles
      : fileOrFiles
        ? [fileOrFiles]
        : [];
  }

  function getPrimaryFile(fileOrFiles) {
    return getFiles(fileOrFiles)[0] ?? null;
  }

  useEffect(() => {
    if (customCsState.name) {
      setCsName(customCsState.name);
    } else setCsName("");
    if (customCsState.email) {
      setEmail(customCsState.email);
    } else setEmail("");
    if (
      customCsState.resampleStrategy === "SIM" ||
      customCsState.resampleStrategy === "UPPAAL"
    ) {
      setResampleStrategy(customCsState.resampleStrategy);
    } else setResampleStrategy("");
    if (customCsState.uppaalModelFile) {
      setUppaalModelFile(customCsState.uppaalModelFile);
    } else setUppaalModelFile(null);
    if (customCsState.uppaalQueryFile) {
      setUppaalQueryFile(customCsState.uppaalQueryFile);
    } else setUppaalQueryFile(null);
    if (customCsState.csvFile) {
      setCSVFile(customCsState.csvFile);
    } else setCSVFile(null);
  }, [
    customCsState.name,
    customCsState.email,
    customCsState.resampleStrategy,
    customCsState.uppaalModelFile,
    customCsState.uppaalQueryFile,
    customCsState.csvFile,
  ]);

  useEffect(() => {
    let dis = true;
    if (
      customCsState.name === null ||
      customCsState.resampleStrategy === null ||
      !customCsState.name.trim() ||
      !customCsState.resampleStrategy.trim() ||
      customCsState.resampleStrategy ===
        "----please select a resample strategy----"
    ) {
      dis = false;
    }
    if (
      customCsState.resampleStrategy === "UPPAAL" &&
      (customCsState.uppaalModelFile === null ||
        customCsState.uppaalQueryFile === null)
    ) {
      dis = false;
    }
    if (
      customCsState.resampleStrategy === "SIM" &&
      customCsState.csvFile === null
    ) {
      dis = false;
    }
    handleBtnDisabled(dis);
  }, [customCsState]);

  function markTouched(field) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  const strategyChosen =
    resampleStrategy === "SIM" || resampleStrategy === "UPPAAL";
  const nameError = touched.name && !csName.trim();
  const strategyError = touched.strategy && !strategyChosen;

  function handleCsName(e) {
    const value = e.target.value;
    setCsName(value);
    markTouched("name");
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "name", value },
    });
  }

  function handleEmail(e) {
    const value = e.target.value;
    setEmail(value);
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "email", value },
    });
  }

  function handleStrategy(e) {
    const value = e.target.value;
    setResampleStrategy(value);
    markTouched("strategy");
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "resampleStrategy", value },
    });
    resetSelectedVariables();
  }

  function handleCSVFile(fileOrFiles) {
    const files = getFiles(fileOrFiles);
    const value = files.length > 1 ? files : (files[0] ?? null);
    setCSVFile(value);
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "csvFile", value },
    });

    // Read the file content and parse it
    const file = getPrimaryFile(fileOrFiles);
    if (file && file.name.toLowerCase().endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result || "";
          const variables = parseCSV(text); // Pass text, not file

          if (variables.length === 0) {
            toast.error(
              "Could not find any columns in that CSV — check the file has a header row.",
              { theme: "colored" },
            );
          }

          customCsDispatch({
            type: "UPDATE_FIELD",
            payload: { key: "csvHeaders", value: variables },
          });
          resetSelectedVariables();
        } catch (err) {
          console.error("Failed to parse CSV:", err);
          toast.error(`Could not read that CSV file: ${err.message}`, {
            theme: "colored",
          });
        }
      };
      reader.onerror = () => {
        toast.error("Could not read that CSV file.", { theme: "colored" });
      };
      reader.readAsText(file);
    }
  }

  // File handlers - save File object to context
  function handleUppaalModelFile(fileOrFiles) {
    const value = getPrimaryFile(fileOrFiles);
    setUppaalModelFile(value);
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "uppaalModelFile", value },
    });
  }

  function handleUppaalQueryFile(fileOrFiles) {
    const value = getPrimaryFile(fileOrFiles);
    setUppaalQueryFile(value);
    customCsDispatch({
      type: "UPDATE_FIELD",
      payload: { key: "uppaalQueryFile", value },
    });

    // Read the file content and parse it
    const file = getPrimaryFile(fileOrFiles);
    if (file && file.name.toLowerCase().endsWith(".q")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result || "";
          const variables = parseUppaalQuery(text); // Pass text, not file

          if (!variables) {
            toast.error(
              "Could not parse that query file — expected a line like simulate[<=TAU;20]{var1, var2}.",
              { theme: "colored" },
            );
          }

          customCsDispatch({
            type: "UPDATE_FIELD",
            payload: { key: "uppaalQuery", value: variables },
          });
          resetSelectedVariables();
        } catch (err) {
          console.error("Failed to parse UPPAAL query:", err);
          toast.error(`Could not read that query file: ${err.message}`, {
            theme: "colored",
          });
        }
      };
      reader.onerror = () => {
        toast.error("Could not read that UPPAAL query file.", {
          theme: "colored",
        });
      };
      reader.readAsText(file);
    }
  }

  return (
    <>
      <div>
        <Input
          type="text"
          title="Custom Case Study Name*"
          placeholder="Enter case study name"
          handleChange={(e) => handleCsName(e)}
          value={csName}
          required={true}
        />
        {nameError && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            Case study name is required.
          </p>
        )}
      </div>
      <div>
        <Input
          type="select"
          value={resampleStrategy}
          title="Resample Strategy of your case study*"
          options={[
            "----please select a resample strategy----",
            "SIM",
            "UPPAAL",
          ]}
          required={true}
          handleChange={(e) => handleStrategy(e)}
        />
        {strategyError && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            Please select a resample strategy.
          </p>
        )}
      </div>
      <Input
        type="text"
        title="Enter your email"
        placeholder="your@mail.com"
        value={email}
        handleChange={(e) => handleEmail(e)}
      />
      {resampleStrategy.toLowerCase() === "uppaal" && (
        <>
          <h1 className="text-3xl text-center text-blue-700 dark:text-blue-300 font-bold m-5">
            Upload UPPAAL Files
          </h1>
          <Input
            type="file"
            title="UPPAAL Model file"
            value={uppaalModelFile}
            accept=".xml"
            multiple={false}
            onFileSelect={(e) => handleUppaalModelFile(e)}
          />
          <Input
            type="file"
            title="UPPAAL Query file"
            accept=".q"
            value={uppaalQueryFile}
            multiple={false}
            onFileSelect={(e) => handleUppaalQueryFile(e)}
          />
          {(!uppaalModelFile || !uppaalQueryFile) && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Both the UPPAAL model (.xml) and query (.q) files are required.
            </p>
          )}
        </>
      )}
      {resampleStrategy.toLowerCase() === "sim" && (
        <>
          <h1 className="text-3xl text-center text-blue-700 dark:text-blue-300 font-bold m-5">
            Upload CSV file
          </h1>
          <Input
            type="file"
            title="CSV file"
            accept=".csv"
            value={CSVFile}
            multiple={true}
            onFileSelect={(e) => handleCSVFile(e)}
          />
          {!CSVFile && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              At least one CSV file is required.
            </p>
          )}
        </>
      )}
    </>
  );
}
