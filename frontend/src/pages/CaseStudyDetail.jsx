import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { ClipLoader } from "react-spinners";
import { MdArrowBack } from "@react-icons/all-files/md/MdArrowBack";
import { MdErrorOutline } from "@react-icons/all-files/md/MdErrorOutline";
import { MdCancel } from "@react-icons/all-files/md/MdCancel";
import { MdFileDownload } from "@react-icons/all-files/md/MdFileDownload";
import { MdInsertDriveFile } from "@react-icons/all-files/md/MdInsertDriveFile";
import { MdStop } from "@react-icons/all-files/md/MdStop";
import Button from "../components/Button";
import ButtonWithIcon from "../components/ButtonWithIcon";
import Alert from "../components/Alert";
import Dialog from "../components/Dialog";
import StatusBadge from "../components/StatusBadge";
import BoolBadge from "../components/BoolBadge";
import { cancelCaseStudy } from "../functions/submitCaseStudy";

const BASE_URL = "http://127.0.0.1:8000";

function fileName(url) {
  if (!url) return null;
  try {
    return decodeURIComponent(url.split("?")[0].split("/").pop());
  } catch {
    return url;
  }
}

function FileLink({ url }) {
  if (!url) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline break-all">
      <MdInsertDriveFile className="shrink-0" /> {fileName(url)}
    </a>
  );
}

function PillList({ items }) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return <span className="text-gray-400 dark:text-gray-500">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((item, idx) => (
        <span
          key={`${item}-${idx}`}
          className="rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-3 py-1 text-sm">
          {String(item)}
        </span>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </dt>
      <dd className="text-gray-800 dark:text-gray-100 text-lg break-words">
        {children}
      </dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
      <h3 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">
        {title}
      </h3>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {children}
      </dl>
    </section>
  );
}

export default function CaseStudyDetail() {
  const { id } = useParams();
  const [cs, setCs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stopping, setStopping] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`${BASE_URL}/api/case-study/${id}/`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setCs(json);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const isDone =
    cs?.status === "COMPLETED" || Boolean(cs?.final_result_pdf && cs?.final_result_txt);
  const isFailed = cs?.status === "FAILED";
  const isCancelled = cs?.status === "CANCELLED";
  const isInProgress = !isDone && !isFailed && !isCancelled;

  async function handleStop() {
    setStopping(true);
    try {
      const updated = await cancelCaseStudy(cs.id);
      setCs(updated);
      toast.info("The algorithm was stopped.", { theme: "colored" });
    } catch (err) {
      toast.error(`Could not stop: ${err.message}`, { theme: "colored" });
    } finally {
      setStopping(false);
    }
  }

  return (
    <section className="py-16 bg-white dark:bg-slate-800 shadow-lg rounded-lg max-w-5xl mx-auto my-10 px-8 md:px-12">
      <div className="mb-8">
        <Button
          text="Back to Case Studies"
          link="/case-studies"
          icon={<MdArrowBack />}
          classes="bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600"
        />
      </div>

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

      {loading ? (
        <div className="flex justify-center py-16">
          <ClipLoader />
        </div>
      ) : error ? (
        <Alert style="danger" text={`Could not load case study #${id}: ${error}`} />
      ) : !cs ? (
        <Alert style="danger" text={`Case study #${id} was not found.`} />
      ) : (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">
                {cs.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Case study #{cs.id}
                {cs.created_at &&
                  ` · created ${new Date(cs.created_at).toLocaleString()}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-3 py-1 text-sm font-semibold">
                {cs.resample_strategy}
              </span>
              <StatusBadge status={cs.status} />
            </div>
          </div>

          {isFailed && (
            <div className="rounded-2xl border border-red-200 dark:border-red-900/50 p-6 text-center">
              <MdErrorOutline className="mx-auto h-10 w-10 text-red-500 mb-3" />
              <p className="text-gray-700 dark:text-gray-200 font-semibold mb-2">
                This case study failed to run.
              </p>
              {cs.error_message && (
                <pre className="text-left text-sm bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                  {cs.error_message}
                </pre>
              )}
            </div>
          )}

          {isCancelled && (
            <div className="rounded-2xl border border-gray-200 dark:border-slate-700 p-6 text-center">
              <MdCancel className="mx-auto h-10 w-10 text-gray-400 mb-3" />
              <p className="text-gray-700 dark:text-gray-200 font-semibold">
                This case study was cancelled before it finished.
              </p>
            </div>
          )}

          {isInProgress && (
            <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 p-6 text-center">
              <p className="text-gray-700 dark:text-gray-200 mb-4">
                This case study is still running.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  text="View live progress"
                  link={`/results/${cs.id}`}
                  classes="bg-blue-600 text-white font-bold hover:bg-blue-700"
                />
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

          {isDone && (
            <div>
              {cs.final_result_pdf && (
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-inner mb-6">
                  <iframe
                    src={cs.final_result_pdf}
                    width="100%"
                    height="500"
                    title="Learned automaton"
                    className="block bg-white"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-4 justify-center">
                {cs.final_result_pdf && (
                  <ButtonWithIcon
                    classes="bg-blue-600 text-white hover:bg-blue-700"
                    text="Download PDF"
                    href={cs.final_result_pdf}
                    target="_blank"
                    icon={<MdFileDownload />}
                  />
                )}
                {cs.final_result_txt && (
                  <ButtonWithIcon
                    classes="bg-blue-600 text-white hover:bg-blue-700"
                    text="Download source (.txt)"
                    href={cs.final_result_txt}
                    target="_blank"
                    icon={<MdFileDownload />}
                  />
                )}
              </div>
            </div>
          )}

          <Section title="General">
            <Field label="Case study name">{cs.name}</Field>
            <Field label="Email">
              {cs.email || <span className="text-gray-400 dark:text-gray-500">—</span>}
            </Field>
            <Field label="Resample strategy">{cs.resample_strategy}</Field>
            <Field label="Status">
              <StatusBadge status={cs.status} />
            </Field>
          </Section>

          <Section title="Variables">
            <Field label="Driver signal">
              <PillList items={cs.driver_signal} />
            </Field>
            <Field label="Main variable">
              {cs.main_variable || (
                <span className="text-gray-400 dark:text-gray-500">—</span>
              )}
            </Field>
            <Field label="Context variables">
              <PillList items={cs.context_variables} />
            </Field>
          </Section>

          <Section title="Uploaded files">
            <Field label="UPPAAL model (.xml)">
              <FileLink url={cs.uppaal_model_file} />
            </Field>
            <Field label="UPPAAL query (.q)">
              <FileLink url={cs.uppaal_query_file} />
            </Field>
            <div className="md:col-span-2">
              <Field label="CSV files">
                {cs.csv_files && cs.csv_files.length > 0 ? (
                  <ul className="space-y-2">
                    {cs.csv_files.map((f) => (
                      <li key={f.id}>
                        <FileLink url={f.file} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">—</span>
                )}
              </Field>
            </div>
          </Section>

          <Section title="Algorithm parameters">
            <Field label="Noise">{cs.noise}</Field>
            <Field label="N min">{cs.n_min}</Field>
            <Field label="P-value">{cs.p_value}</Field>
            <Field label="HT query type">{cs.ht_query_type || "—"}</Field>
            <Field label="Eq condition">{cs.eq_condition || "—"}</Field>
            <Field label="MI query">
              <BoolBadge value={Boolean(cs.mi_query)} />
            </Field>
            <Field label="Plot DDTW">
              <BoolBadge value={Boolean(cs.plot_ddtw)} />
            </Field>
            <Field label="HT query">
              <BoolBadge value={Boolean(cs.ht_query)} />
            </Field>
            <Field label="Is aggregation">
              <BoolBadge value={Boolean(cs.is_aggregation)} />
            </Field>
          </Section>

          {cs.user_json && (
            <section className="rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
              <h3 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">
                Events model
              </h3>
              <pre className="whitespace-pre-wrap break-words text-sm bg-gray-100 dark:bg-slate-900 rounded-lg p-4 overflow-x-auto">
                {JSON.stringify(cs.user_json, null, 2)}
              </pre>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
