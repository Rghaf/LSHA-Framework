import { useContext } from "react";
import Input from "../../inputs/Input";
import Alert from "../../Alert";
import { CustomCsContext } from "../../../contexts/CustomCsContext";
import { requiresUppaalFiles } from "../../../functions/mapCaseStudyJson";

function primary(fileOrFiles) {
  const arr = Array.isArray(fileOrFiles)
    ? fileOrFiles
    : fileOrFiles
      ? [fileOrFiles]
      : [];
  return arr[0] ?? null;
}

function ProvidedNote({ file, label }) {
  if (!file) return null;
  const files = Array.isArray(file) ? file : [file];
  return (
    <p className="mt-2 text-sm text-green-700 dark:text-green-400">
      ✓ {label}: {files.map((f) => f.name).join(", ")}
    </p>
  );
}

export default function DataFilesStep() {
  const { customCsState, customCsDispatch } = useContext(CustomCsContext);
  const needsUppaal = requiresUppaalFiles(customCsState.resampleStrategy);

  function setField(key, value) {
    customCsDispatch({ type: "UPDATE_FIELD", payload: { key, value } });
  }

  function handleUppaalModel(fileOrFiles) {
    setField("uppaalModelFile", primary(fileOrFiles));
  }

  function handleUppaalQuery(fileOrFiles) {
    setField("uppaalQueryFile", primary(fileOrFiles));
  }

  function handleCsv(fileOrFiles) {
    const files = Array.isArray(fileOrFiles)
      ? fileOrFiles
      : fileOrFiles
        ? [fileOrFiles]
        : [];
    setField("csvFile", files.length > 1 ? files : (files[0] ?? null));
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Alert
        style="info"
        text={`Strategy: ${customCsState.resampleStrategy}. Provide the data files required to generate traces.`}
        m="mb-2"
      />

      {needsUppaal ? (
        <>
          <div>
            <Input
              type="file"
              title="UPPAAL Model file (.xml)"
              accept=".xml"
              multiple={false}
              value={customCsState.uppaalModelFile}
              onFileSelect={handleUppaalModel}
            />
            <ProvidedNote file={customCsState.uppaalModelFile} label="Loaded" />
          </div>
          <div>
            <Input
              type="file"
              title="UPPAAL Query file (.q)"
              accept=".q"
              multiple={false}
              value={customCsState.uppaalQueryFile}
              onFileSelect={handleUppaalQuery}
            />
            <ProvidedNote file={customCsState.uppaalQueryFile} label="Loaded" />
          </div>
        </>
      ) : (
        <div>
          <Input
            type="file"
            title="CSV file(s)"
            accept=".csv"
            multiple={true}
            value={customCsState.csvFile}
            onFileSelect={handleCsv}
          />
          <ProvidedNote file={customCsState.csvFile} label="Loaded" />
        </div>
      )}
    </div>
  );
}
