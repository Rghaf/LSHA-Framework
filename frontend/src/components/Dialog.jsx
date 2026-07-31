import { useState } from "react";
import Button from "./Button";

export default function Dialog({
  show = true,
  title = "Save your progress!",
  message = "Do you want continue with your previous progeress, or you want start a new case study?",
  note = "If you start from zero, you can't restore what you did before",
  confirmText = "Cancel & Restart",
  confirmClasses = "text-white bg-red-600 hover:bg-red-700",
  cancelText = "Continue",
  dialogAction,
  onClose,
}) {
  const [showDialog, setShowDialog] = useState(show);

  function closeDialog() {
    setShowDialog(false);
    onClose?.();
  }

  return (
    <>
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 backdrop-blur-xs transition-opacity"
            onClick={closeDialog}
          />
          <div className="relative mx-4 w-full max-w-md bg-white dark:bg-slate-800 rounded-2x border rounded-2xl border-blue-600 shadow-2xl p-6">
            <button
              onClick={closeDialog}
              aria-label="Close"
              className="absolute right-4 top-4 text-black dark:text-gray-200 hover:text-gray-800 dark:hover:text-white">
              ×
            </button>

            <div className="flex items-start gap-4 text-center">
              <div className="min-w-0">
                <h3 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 p-5">
                  {title}
                </h3>
                <p className="mt-1 text-lg text-gray-700 dark:text-gray-300">
                  {message}
                </p>
                {note && (
                  <p className="p-5 text-s text-gray-500 dark:text-gray-400">
                    {note}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-center gap-3">
              {dialogAction && (
                <Button
                  text={confirmText}
                  handleClick={() => {
                    dialogAction();
                    closeDialog();
                  }}
                  classes={confirmClasses}
                />
              )}

              <Button
                text={cancelText}
                handleClick={closeDialog}
                classes="text-white bg-blue-600 hover:bg-blue-700"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
