import { useEffect, useRef, useState } from "react";
import { MdCheckCircle } from "@react-icons/all-files/md/MdCheckCircle";
import { MdRadioButtonUnchecked } from "@react-icons/all-files/md/MdRadioButtonUnchecked";
import { MdSync } from "@react-icons/all-files/md/MdSync";
import { PROGRESS_STEPS, stepIndex, stepLabel, stepRange } from "../data/ProgressSteps";

// Eases the displayed percentage toward the current step's ceiling without
// ever reaching it — real backend transitions move the floor (and ceiling)
// forward, at which point the value jumps up immediately. This keeps the bar
// visibly alive during a long step instead of sitting frozen at one number.
function useAnimatedProgress(min, max) {
  const [value, setValue] = useState(min);
  const stateRef = useRef({ value: min, min, max });

  useEffect(() => {
    const next = Math.max(stateRef.current.value, min);
    stateRef.current = { value: next, min, max };
    setValue(next);
  }, [min, max]);

  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      if (s.max - s.value < 0.3) return;
      const next = s.value + (s.max - s.value) * 0.06;
      stateRef.current = { ...s, value: next };
      setValue(next);
    }, 400);
    return () => clearInterval(id);
  }, []);

  return value;
}

export default function ProgressTracker({ status, currentStep, resampleStrategy }) {
  const range = stepRange(status, currentStep) || { min: 0, max: 5 };
  const percent = useAnimatedProgress(range.min, range.max);
  const activeIndex =
    status === "COMPLETED" ? PROGRESS_STEPS.length : stepIndex(currentStep);

  return (
    <div className="w-full max-w-xl mx-auto text-left">
      <div className="mb-8">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Overall progress
          </span>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
            {Math.round(percent)}%
          </span>
        </div>
        <div className="h-3 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ol className="space-y-4">
        {PROGRESS_STEPS.map((step, index) => {
          const isDone = status === "COMPLETED" || activeIndex > index;
          const isActive = !isDone && activeIndex === index;

          return (
            <li key={step.key} className="flex items-center gap-3">
              {isDone ? (
                <MdCheckCircle className="h-6 w-6 text-green-500 shrink-0" />
              ) : isActive ? (
                <MdSync className="h-6 w-6 text-blue-500 shrink-0 animate-spin" />
              ) : (
                <MdRadioButtonUnchecked className="h-6 w-6 text-gray-300 dark:text-slate-600 shrink-0" />
              )}
              <span
                className={
                  isDone
                    ? "text-gray-500 dark:text-gray-400"
                    : isActive
                      ? "text-gray-900 dark:text-gray-100 font-semibold"
                      : "text-gray-400 dark:text-gray-500"
                }>
                {stepLabel(step.key, resampleStrategy)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
