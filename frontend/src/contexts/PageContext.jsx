import { createContext, useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";

export const PageContext = createContext();

const initialState = {
  pageNum: 1,
  disabled: true,
  loading: false,
  isManual: false,
};

function pageReducer(state, action) {
  switch (action.type) {
    case "NEXT":
      return { ...state, pageNum: state.pageNum + 1, disabled: false };
    case "PREV":
      return { ...state, pageNum: state.pageNum - 1 };
    case "ACTIVE":
      return { ...state, disabled: false };
    case "DISABLE":
      return { ...state, disabled: true };
    case "LOADING":
      return { ...state, loading: true };
    case "LOADING_OFF":
      return { ...state, loading: false };
    case "MANUAL":
      return { ...state, isManual: true };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export function PageProvider({ children }) {
  const [state, dispatch] = useReducer(pageReducer, initialState);
  const navigate = useNavigate();

  function nextPage() {
    dispatch({ type: "NEXT" });
  }

  function prevPage() {
    console.log("prevPage called, pageNum:", state.pageNum);
    if (state.pageNum === 1) {
      console.log("Navigating to / via useNavigate");
      navigate("/", { replace: false });
    } else {
      dispatch({ type: "PREV" });
    }
  }

  function handleSubmit() {
    // Placeholder for submit logic
    console.log("Form submitted");
  }

  function active() {
    dispatch({ type: "ACTIVE" });
  }

  function disable() {
    dispatch({ type: "DISABLE" });
  }

  function loadingOn() {
    dispatch({ type: "LOADING" });
  }

  function loadingOff() {
    dispatch({ type: "LOADING_OFF" });
  }

  return (
    <PageContext.Provider
      value={{
        pageState: state,
        pageDispatch: dispatch,
        nextPage,
        prevPage,
        active,
        disable,
        loadingOn,
        loadingOff,
      }}>
      {children}
    </PageContext.Provider>
  );
}
