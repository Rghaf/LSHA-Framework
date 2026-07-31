import { toast } from "react-toastify";

export function useToast() {
  const showSuccess = (message = "Operation successful!") => {
    toast.success(message, {
      autoClose: 5000,
      closeOnClick: false,
      draggable: true,
      theme: "colored",
    });
  };

  const showError = (message = "An error occurred") => {
    toast.error(message, {
      autoClose: 5000,
      closeOnClick: false,
      draggable: true,
      theme: "colored",
    });
  };

  const showInfo = (message = "Information") => {
    toast.info(message, {
      autoClose: 5000,
      closeOnClick: false,
      draggable: true,
      theme: "colored",
    });
  };

  return { showSuccess, showError, showInfo };
}
