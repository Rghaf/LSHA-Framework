import { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ClipLoader } from "react-spinners";
import { MdArrowForward } from "@react-icons/all-files/md/MdArrowForward";
import { FaUpload } from "@react-icons/all-files/fa/FaUpload";
import Button from "../components/Button";
import DataFilesStep from "../components/form/upload-cs/DataFilesStep";
import ReviewStep from "../components/form/upload-cs/ReviewStep";
import { CustomCsContext } from "../contexts/CustomCsContext";
import { requiresUppaalFiles } from "../functions/mapCaseStudyJson";
import { submitCaseStudy } from "../functions/submitCaseStudy";

const STEPS = [
  {
    title: "Add your data files",
    description:
      "We loaded your case study from JSON. Now upload the data files needed to generate traces.",
  },
  {
    title: "Review & submit",
    description:
      "Double-check everything below, then submit to run the algorithm.",
  },
];

function StepNav({ step }) {
  return (
    <div className="flex justify-center space-x-4 mb-12">
      {STEPS.map((s, index) => (
        <Button
          key={s.title}
          disabled={step !== index + 1}
          text={`${index + 1}-${s.title}`}
          classes="bg-blue-600 text-white font-semibold"
        />
      ))}
    </div>
  );
}

export default function UploadFlow() {
  const { customCsState, customCsDispatch } = useContext(CustomCsContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const hasCaseStudy = Boolean(
    customCsState?.name && customCsState?.resampleStrategy,
  );
  const needsUppaal = requiresUppaalFiles(customCsState?.resampleStrategy);

  const filesReady = useMemo(() => {
    if (needsUppaal) {
      return Boolean(
        customCsState.uppaalModelFile && customCsState.uppaalQueryFile,
      );
    }
    const csv = customCsState.csvFile;
    return Array.isArray(csv) ? csv.length > 0 : Boolean(csv);
  }, [
    needsUppaal,
    customCsState.uppaalModelFile,
    customCsState.uppaalQueryFile,
    customCsState.csvFile,
  ]);

  async function handleSubmit() {
    setIsLoading(true);
    try {
      const { id } = await submitCaseStudy(customCsState);
      customCsDispatch({
        type: "UPDATE_FIELD",
        payload: { key: "id", value: id },
      });
      toast.success(
        "The case study submitted successfully, waiting for results...",
        { theme: "colored" },
      );
      setTimeout(() => navigate(`/results/${id}`), 1200);
    } catch (err) {
      console.error("Failed during the submission sequence:", err);
      toast.error(`Submission failed: ${err.message}`, { theme: "colored" });
    } finally {
      setIsLoading(false);
    }
  }

  if (!hasCaseStudy) {
    return (
      <section className="py-16 bg-white dark:bg-slate-800 shadow-lg rounded-lg max-w-3xl mx-auto my-10 px-8 md:px-12 text-center">
        <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100 mb-4">
          No case study loaded
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
          Drop a case-study JSON file on the home page to start this flow, or
          build one manually with the form.
        </p>
        <div className="flex justify-center gap-4">
          <Button
            text="Back to Home"
            link="/"
            classes="bg-blue-600 text-white font-bold hover:bg-blue-700"
          />
          <Button
            text="Use the form"
            link="/form"
            classes="bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600"
          />
        </div>
      </section>
    );
  }

  const current = STEPS[step - 1];

  return (
    <section className="py-16 bg-white dark:bg-slate-800 shadow-lg rounded-lg max-w-5xl mx-auto my-10 px-8 md:px-12">
      <StepNav step={step} />

      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100 mb-4 leading-tight">
          {current.title}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          {current.description}
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 md:p-12 shadow-inner">
        {step === 1 ? <DataFilesStep /> : <ReviewStep />}
      </div>

      <div className="flex justify-center mt-12 space-x-6">
        {isLoading ? (
          <ClipLoader />
        ) : step === 1 ? (
          <>
            <Button
              text="Back"
              handleClick={() => navigate("/")}
              classes="font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600"
            />
            <Button
              text="Continue to review"
              icon={<MdArrowForward />}
              handleClick={() => setStep(2)}
              disabled={!filesReady}
              classes={
                filesReady
                  ? "text-white font-bold bg-blue-600 hover:bg-blue-700 hover:scale-103"
                  : "font-bold bg-gray-200 text-gray-700"
              }
            />
          </>
        ) : (
          <>
            <Button
              text="Back"
              handleClick={() => setStep(1)}
              classes="font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600"
            />
            <Button
              text="Submit & Run The Algorithm"
              icon={<FaUpload />}
              handleClick={handleSubmit}
              classes="text-white font-bold bg-green-800 hover:bg-green-700 hover:scale-103"
            />
          </>
        )}
      </div>

      {step === 1 && !filesReady && (
        <p className="text-center mt-4 text-sm text-gray-500 dark:text-gray-400">
          {needsUppaal
            ? "Upload both the UPPAAL model (.xml) and query (.q) files to continue."
            : "Upload at least one CSV file to continue."}
        </p>
      )}
    </section>
  );
}
