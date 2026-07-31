import FormNav from "./FormNav";

export default function FormHeader({ header, description }) {
  return (
    <>
      <FormNav />
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100 mb-4 leading-tight">
          {header}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          {description}
        </p>
      </div>
    </>
  );
}
