import { useContext, useEffect } from "react";
import { FormNavData } from "../../data/FormHeaderData";
import Button from "../Button";
import { PageContext } from "../../contexts/PageContext";

export default function FormNav() {
  const { pageState } = useContext(PageContext);
  useEffect(() => {
    console.log(pageState.pageNum);
  }, []);
  return (
    <div className="flex justify-center space-x-4 mb-12">
      {FormNavData.map((d, index) => (
        <Button
          key={index}
          disabled={!(pageState.pageNum === index + 1)}
          text={`${index + 1}-${d}`}
          classes="bg-blue-600 text-white font-semibold"
        />
      ))}
    </div>
  );
}
