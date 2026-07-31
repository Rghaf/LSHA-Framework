import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { CustomCsContext } from "../contexts/CustomCsContext";
import Button from "../components/Button";
import ButtonWithIcon from "../components/ButtonWithIcon";
import ProgressTracker from "../components/ProgressTracker";
import Dialog from "../components/Dialog";
import { cancelCaseStudy, runAlgorithm } from "../functions/submitCaseStudy";
import { MdFileDownload } from "@react-icons/all-files/md/MdFileDownload";
import { MdCheckCircle } from "@react-icons/all-files/md/MdCheckCircle";
import { MdErrorOutline } from "@react-icons/all-files/md/MdErrorOutline";
import { MdCancel } from "@react-icons/all-files/md/MdCancel";
import { MdRefresh } from "@react-icons/all-files/md/MdRefresh";
import { MdStop } from "@react-icons/all-files/md/MdStop";

const BASE_URL = "http://127.0.0.1:8000";
const POLL_INTERVAL_MS = 3000;

function isDone(cs) {
  return cs?.status === "COMPLETED" || Boolean(cs?.final_result_pdf && cs?.final_result_txt);
}

function isFailed(cs) {
  return cs?.status === "FAILED";
}

function isCancelled(cs) {
  return cs?.status === "CANCELLED";
}

function isSettled(cs) {
  return isDone(cs) || isFailed(cs) || isCancelled(cs);
}

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function Results() {
  const { id: idParam } = useParams();
  const { customCsState, customCsDispatch } = useContext(CustomCsContext);
  const navigate = useNavigate();

  // The route can carry the id (bookmarkable/refreshable); fall back to
  // whatever the in-memory form/upload flow last submitted.
  const caseStudyId = idParam || customCsState?.id;

  const [caseStudy, setCaseStudy] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const notifiedRef = useRef(false);
  const startRef = useRef(null);

  useEffect(() => {
    if (!caseStudyId) return;
    startRef.current = Date.now();
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [caseStudyId]);

  useEffect(() => {
    if (!caseStudyId) return;

    let pollInterval;

    const fetchResults = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/case-study/${caseStudyId}/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setCaseStudy(data);
        setFetchError(null);

        if (isSettled(data)) {
          clearInterval(pollInterval);
          if (isDone(data) && !notifiedRef.current) {
            notifiedRef.current = true;
            toast.success("Success! Results are ready", { theme: "colored" });
          }
        }
      } catch (err) {
        console.error("Error fetching results:", err);
        setFetchError(err.message);
      }
    };

    fetchResults();
    pollInterval = setInterval(fetchResults, POLL_INTERVAL_MS);
    return () => clearInterval(pollInterval);
  }, [caseStudyId]);

  async function handleRetry() {
    setRetrying(true);
    try {
      await runAlgorithm(caseStudyId);
      notifiedRef.current = false;
      setCaseStudy((prev) =>
        prev ? { ...prev, status: "PENDING", current_step: null, error_message: null } : prev,
      );
      toast.info("Retrying the algorithm…", { theme: "colored" });
    } catch (err) {
      toast.error(`Retry failed: ${err.message}`, { theme: "colored" });
    } finally {
      setRetrying(false);
    }
  }

  async function handleStop() {
    setStopping(true);
    try {
      const updated = await cancelCaseStudy(caseStudyId);
      setCaseStudy(updated);
      toast.info("The algorithm was stopped.", { theme: "colored" });
    } catch (err) {
      toast.error(`Could not stop: ${err.message}`, { theme: "colored" });
    } finally {
      setStopping(false);
    }
  }

  function handleStartOver() {
    customCsDispatch({ type: "RESET" });
    navigate("/");
  }

  if (!caseStudyId) {
    return (
      <section className="py-16 bg-white dark:bg-slate-900">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100 mb-4">
            No case study selected
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            This page shows the progress and results of a submitted case
            study. Submit one from the form or upload flow to see it here.
          </p>
          <div className="flex justify-center gap-4">
            <Button
              text="Back to Home"
              link="/"
              classes="bg-blue-600 text-white font-bold hover:bg-blue-700"
            />
            <Button
              text="Use the form"
              link="/form"
              classes="bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600"
            />
          </div>
        </div>
      </section>
    );
  }

  const done = isDone(caseStudy);
  const failed = isFailed(caseStudy);
  const cancelled = isCancelled(caseStudy);

  return (
    <section className="py-16 bg-white dark:bg-slate-900">
      <div className="max-w-4xl mx-auto px-6">
        {showStopConfirm && (
          <Dialog
            show={showStopConfirm}
            title="Stop this case study?"
            message="This will permanently cancel the running algorithm. Any progress made so far is lost."
            note="This cannot be undone — you'll need to retry from the start if you change your mind."
            confirmText="Stop it"
            confirmClasses="text-white bg-red-600 hover:bg-red-700"
            cancelText="Keep running"
            dialogAction={handleStop}
            onClose={() => setShowStopConfirm(false)}
          />
        )}

        {failed ? (
          <div className="text-center bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 rounded-2xl shadow-lg p-8 md:p-12">
            <MdErrorOutline className="mx-auto h-14 w-14 text-red-500 mb-4" />
            <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100 mb-3">
              The algorithm failed
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-xl mx-auto">
              Case study #{caseStudyId}
              {caseStudy?.name ? ` — "${caseStudy.name}"` : ""} could not
              finish running.
            </p>
            {caseStudy?.error_message && (
              <pre className="text-left text-sm bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg p-4 overflow-x-auto mb-8 whitespace-pre-wrap">
                {caseStudy.error_message}
              </pre>
            )}
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                text="Back to Home"
                handleClick={handleStartOver}
                classes="bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600"
              />
              <Button
                text={retrying ? "Retrying…" : "Retry"}
                icon={<MdRefresh />}
                handleClick={handleRetry}
                disabled={retrying}
                classes="bg-blue-600 text-white font-bold hover:bg-blue-700"
              />
            </div>
          </div>
        ) : cancelled ? (
          <div className="text-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-lg p-8 md:p-12">
            <MdCancel className="mx-auto h-14 w-14 text-gray-400 mb-4" />
            <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100 mb-3">
              Stopped
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-xl mx-auto">
              Case study #{caseStudyId}
              {caseStudy?.name ? ` — "${caseStudy.name}"` : ""} was cancelled
              before it finished.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                text="Back to Home"
                handleClick={handleStartOver}
                classes="bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600"
              />
              <Button
                text={retrying ? "Retrying…" : "Run it again"}
                icon={<MdRefresh />}
                handleClick={handleRetry}
                disabled={retrying}
                classes="bg-blue-600 text-white font-bold hover:bg-blue-700"
              />
            </div>
          </div>
        ) : done ? (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-lg p-8 md:p-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <MdCheckCircle className="h-10 w-10 text-green-500 shrink-0" />
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">
                    {caseStudy.name}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Case study #{caseStudy.id}
                    {caseStudy.created_at &&
                      ` · created ${new Date(caseStudy.created_at).toLocaleString()}`}
                  </p>
                </div>
              </div>
              {caseStudy.resample_strategy && (
                <span className="inline-flex self-start md:self-auto items-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-3 py-1 text-sm font-semibold">
                  {caseStudy.resample_strategy}
                </span>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-inner mb-8">
              <iframe
                src={caseStudy.final_result_pdf}
                width="100%"
                height="600"
                title="Learned automaton"
                className="block bg-white"
              />
            </div>

            <div className="flex flex-wrap gap-4 justify-center">
              <ButtonWithIcon
                classes="bg-blue-600 text-white hover:bg-blue-700"
                text="Download PDF"
                href={caseStudy.final_result_pdf}
                target="_blank"
                icon={<MdFileDownload />}
              />
              <ButtonWithIcon
                classes="bg-blue-600 text-white hover:bg-blue-700"
                text="Download source (.txt)"
                href={caseStudy.final_result_txt}
                target="_blank"
                icon={<MdFileDownload />}
              />
            </div>

            <div className="mt-8 text-center">
              <Button
                text="Start a new case study"
                handleClick={handleStartOver}
                classes="bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600"
              />
            </div>
          </div>
        ) : (
          <div className="text-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-lg p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 dark:text-gray-100 mb-3">
              Running your case study
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
              This page updates itself automatically — feel free to leave it
              running in the background and come back to this link later.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-10">
              Case study #{caseStudyId} · {formatElapsed(elapsed)} elapsed
            </p>

            <ProgressTracker
              status={caseStudy?.status || "PENDING"}
              currentStep={caseStudy?.current_step}
              resampleStrategy={caseStudy?.resample_strategy}
            />

            {fetchError && (
              <p className="mt-10 text-sm text-amber-600 dark:text-amber-400">
                Having trouble reaching the server — still retrying…
              </p>
            )}

            <div className="mt-10">
              <Button
                text={stopping ? "Stopping…" : "Stop"}
                icon={<MdStop />}
                handleClick={() => setShowStopConfirm(true)}
                disabled={stopping}
                classes="bg-gray-200 text-gray-700 font-bold hover:bg-red-100 hover:text-red-700 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-red-900/40 dark:hover:text-red-300"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
