import { createContext, useReducer, useMemo } from "react";

export const CustomCsContext = createContext();

const initialState = {
  // General configuration
  id: null,
  name: null,
  email: null,

  // resample strategy: SIM or UPPAAL
  resampleStrategy: null,

  // files
  uppaalModelFile: null,
  uppaalQueryFile: null,
  csvFile: null,

  // extracted data from uploaded files
  csvHeaders: null,
  uppaalQuery: null,

  startDate: null,
  endDate: null,

  // the main variables which track and will be used in the conditions
  driverSignal: null,
  mainVariable: null,
  contextVariables: null,
  // variables: [
  //   {
  //     id: null,
  //     name: null,
  //     symbol: null,
  //     data_column: null,
  //   },
  // ],

  // specific variables for case study
  userJson: null,

  // variables for configuration of teacher.py
  noise: 0.0,
  // 0 is not a meaningful significance threshold; match the backend
  // model's own default (rest_api/models.py CaseStudy.p_value) so an
  // untouched form still submits a sane value.
  pValue: 0.05,
  miQuery: false,
  plotDdtw: false,
  htQuery: false,
  htQueryType: "S",
  eqCondition: "W",
  isAggregation: false,
  nMin: 10,

  // result files
  resultTxt: null,
  resultPdf: null,
};

export function CustomCsReducer(state, action) {
  switch (action.type) {
    case "CREATED":
      return {
        ...state,
        ...action.payload,
      };
    case "UPDATE_FIELD":
      return {
        ...state,
        [action.payload.key]: action.payload.value,
      };

    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export function CustomCsProvider({ children }) {
  const [state, dispatch] = useReducer(CustomCsReducer, initialState);

  const value = useMemo(
    () => ({ customCsState: state, customCsDispatch: dispatch }),
    [state, dispatch],
  );

  return (
    <CustomCsContext.Provider value={value}>
      {children}
    </CustomCsContext.Provider>
  );
}
