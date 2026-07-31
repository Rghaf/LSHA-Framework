import { useContext, useEffect, useState } from "react";
import FormContainer from "./FormContainer";
import { usePost } from "../../hooks/usePost";
import { useToast } from "../../hooks/useToast";
import FormPage1 from "./custom-cs/FormPage1";
import FormPage2 from "./custom-cs/FormPage2";
import FormPage3 from "./custom-cs/FormPage3";
import { PageContext } from "../../contexts/PageContext";
import { CustomCsContext } from "../../contexts/CustomCsContext";
import Dialog from "../Dialog";
import FormPage4 from "./custom-cs/FormPage4";
import FormPage5 from "./custom-cs/FormPage5";
import FormPage6 from "./custom-cs/FormPage6";

export default function Form({ data }) {
  const csOptions = ["Thermo", "HRI", "Energy", "Auto Twin", "GR3N"];
  const rsOptions = ["Option 1", "Option 2", "Option 3"];
  const [result, setResult] = useState({});
  const [csCreated, setCsCreated] = useState(false);
  const [lists, setLists] = useState([]);
  // const myData = useFetch("http://127.0.0.1:8000/api/case-study/");

  // Change data according to page
  const [pageData, setPageData] = useState([]);
  const { pageState, pageDispatch, nextPage, prevPage, active, disable } =
    useContext(PageContext);
  const { customCsState, customCsDispatch } = useContext(CustomCsContext);
  const { showSuccess, showError, showInfo } = useToast();
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (
      customCsState.name ||
      customCsState.email ||
      customCsState.resampleStrategy
    ) {
      setShowDialog(true);
      console.log(showDialog);
    }
  }, []);

  useEffect(() => {
    console.log("CS NAME:", customCsState.name);
    console.log("CS EMAIL:", customCsState.email);
    console.log("CS STRATEGY:", customCsState.resampleStrategy);
    console.log("UPPAL", customCsState.uppaalModelFile);
    console.log("QUERY", customCsState.uppaalQueryFile);
    console.log("DATA FILE", customCsState.csvFile);
    console.log("CSV HEADERS", customCsState.csvHeaders);
    console.log("DRIVER SIGNAL", customCsState.driverSignal);
    console.log("UPPAAL Query", customCsState.uppaalQuery);
    console.log("UPPAL VARS", customCsState.uppaalVariables);
    console.log("USER JSON", customCsState.userJson);
    console.log("CONTEXT VARS", customCsState.contextVariables);
    console.log("NOISE", customCsState.noise);
    console.log("P-VALUE", customCsState.pValue);
    console.log("MI QUERY", customCsState.miQuery);
    console.log("PLOT DDTW", customCsState.plotDdtw);
    console.log("HT QUERY", customCsState.htQuery);
    console.log("HT QUERY TYPE", customCsState.htQueryType);
    console.log("EQ CONDITION", customCsState.eqCondition);
    console.log("IS STOCHASTIC", customCsState.isStochastic);
    (customCsState.events || []).forEach((event, index) => {
      console.log(
        `EVENT - ${index}`,
        event.channel,
        event.condition,
        event.symbol,
      );
    });
  }, [customCsState]);

  function handleBtnDisabled(dis) {
    if (!dis) disable();
    else active();
  }

  const { postData, isLoading, error, response } = usePost(
    "http://127.0.0.1:8000/api/case-study/",
  );

  return (
    <>
      {showDialog && (
        <Dialog
          show={showDialog}
          dialogAction={() => {
            customCsDispatch({
              type: "RESET",
            });
            pageDispatch({
              type: "RESET",
            });
            setShowDialog(false);
          }}
        />
      )}

      <form
        onSubmit={(e) => e.preventDefault()}
        className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 md:p-12 shadow-inner">
        <div className="max-w-xl mx-auto space-y-8">
          <FormContainer>
            {pageState.pageNum === 1 && (
              <FormPage1
                // created={csCreated}
                handleBtnDisabled={handleBtnDisabled}
              />
            )}
            {pageState.pageNum === 2 && (
              <FormPage2 handleBtnDisabled={handleBtnDisabled} />
            )}
            {pageState.pageNum === 3 && (
              <FormPage3 handleBtnDisabled={handleBtnDisabled} />
            )}
            {pageState.pageNum === 4 && (
              <FormPage4 handleBtnDisabled={handleBtnDisabled} />
            )}
            {pageState.pageNum === 5 && (
              <FormPage5 handleBtnDisabled={handleBtnDisabled} />
            )}
            {pageState.pageNum === 6 && (
              <FormPage6 handleBtnDisabled={handleBtnDisabled} />
            )}
          </FormContainer>
        </div>
      </form>
    </>
  );
}
