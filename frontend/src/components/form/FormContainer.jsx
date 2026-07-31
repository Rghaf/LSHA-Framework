import { ToastContainer } from "react-toastify";

export default function FormContainer({ children }) {
  return (
    <div className="flex flex-col space-y-6">
      {children}
      <ToastContainer />
    </div>
  );
}
