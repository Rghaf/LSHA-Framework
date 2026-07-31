import { useContext } from "react";
import Button from "../Button";
import { MdArrowForward } from "@react-icons/all-files/md/MdArrowForward";
import { PageContext } from "../../contexts/PageContext";
import FormSubmit from "./FormSubmit";

export default function FormFooter() {
  const { pageState, nextPage, prevPage } = useContext(PageContext);

  return (
    <div className="flex justify-center mt-12 space-x-6">
      {pageState.pageNum < 5 ? (
        <>
          <Button
            text="Back"
            handleClick={prevPage}
            classes="font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600"
          />
          <Button
            text="Continue to next step"
            icon={<MdArrowForward />}
            handleClick={nextPage}
            classes={
              pageState.disabled
                ? "font-bold bg-gray-200 text-gray-700"
                : "text-white font-bold bg-blue-600 hover:bg-blue-700 hover:scale-103"
            }
            disabled={pageState.disabled}
          />
        </>
      ) : (
        <FormSubmit />
      )}
    </div>
  );
}
