import { useContext, useState } from "react";
import Button from "../Button";
import { FaUpload } from "@react-icons/all-files/fa/FaUpload";
import { PageContext } from "../../contexts/PageContext";
import { CustomCsContext } from "../../contexts/CustomCsContext";
import { ClipLoader } from "react-spinners";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { submitCaseStudy } from "../../functions/submitCaseStudy";

export default function FormSubmit() {
  const { customCsState, customCsDispatch } = useContext(CustomCsContext);
  const { prevPage } = useContext(PageContext);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmitToApi() {
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

  if (isLoading) return <ClipLoader />;

  return (
    <>
      <Button
        text="Back"
        handleClick={prevPage}
        classes="font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600"
      />
      <Button
        text="Run The Algorithm"
        icon={<FaUpload />}
        handleClick={handleSubmitToApi}
        classes="text-white font-bold bg-green-800 hover:bg-green-700 hover:scale-103"
      />
    </>
  );
}
