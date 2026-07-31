import { useContext, useState } from "react";

import Form from "../components/form/Form";
import FormFooter from "../components/form/FormFooter";
import FormHeader from "../components/form/FormHeader";
import { PageContext } from "../contexts/PageContext";
import { FormHeaderData } from "../data/FormHeaderData";

export default function FormPage() {
  const { pageState, nextPage, prevPage, active, disable } =
    useContext(PageContext);

  return (
    <section className="py-16 bg-white dark:bg-slate-800 shadow-lg rounded-lg max-w-5xl mx-auto my-10 px-8 md:px-12">
      <FormHeader
        header={FormHeaderData[pageState.pageNum - 1].header}
        description={FormHeaderData[pageState.pageNum - 1].description}
      />
      <Form />
      <FormFooter />
    </section>
  );
}
