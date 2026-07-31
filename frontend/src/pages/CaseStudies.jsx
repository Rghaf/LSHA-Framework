import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { MdSearch } from "@react-icons/all-files/md/MdSearch";
import { MdChevronRight } from "@react-icons/all-files/md/MdChevronRight";
import { MdFolderOpen } from "@react-icons/all-files/md/MdFolderOpen";
import Button from "../components/Button";
import Alert from "../components/Alert";
import StatusBadge from "../components/StatusBadge";

const BASE_URL = "http://127.0.0.1:8000";
const PAGE_SIZE = 20;

export default function CaseStudies() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ count: 0, results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debounce typing before it drives a new request; reset back to page 1
  // whenever the search term actually changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);

    fetch(`${BASE_URL}/api/case-study/?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
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
  }, [page, search]);

  const totalPages = Math.max(1, Math.ceil((data.count || 0) / PAGE_SIZE));

  return (
    <section className="py-16 bg-white dark:bg-slate-800 shadow-lg rounded-lg max-w-5xl mx-auto my-10 px-8 md:px-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100 mb-4 leading-tight">
          Case Studies
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Browse every case study that has been submitted, and open one to
          see its full configuration, files, and results.
        </p>
      </div>

      <div className="relative max-w-md mx-auto mb-10">
        <MdSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-lg"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <ClipLoader />
        </div>
      ) : error ? (
        <Alert style="danger" text={`Could not load case studies: ${error}`} />
      ) : data.results.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <MdFolderOpen className="mx-auto h-12 w-12 mb-3 text-gray-300 dark:text-slate-600" />
          {search
            ? `No case studies match "${search}".`
            : "No case studies have been submitted yet."}
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {data.results.map((cs) => (
              <li key={cs.id}>
                <Link
                  to={`/case-studies/${cs.id}`}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-colors duration-200">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                      {cs.name}
                    </p>
                    {cs.email && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {cs.email}
                      </p>
                    )}
                  </div>
                  <span className="hidden sm:inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-3 py-1 text-xs font-semibold shrink-0">
                    {cs.resample_strategy}
                  </span>
                  <span className="hidden md:inline text-sm text-gray-500 dark:text-gray-400 shrink-0 w-32 text-right">
                    {cs.created_at
                      ? new Date(cs.created_at).toLocaleDateString()
                      : "—"}
                  </span>
                  <StatusBadge status={cs.status} />
                  <MdChevronRight className="h-5 w-5 text-gray-300 dark:text-slate-600 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-center gap-4 mt-10">
            <Button
              text="Previous"
              handleClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              classes="bg-blue-600 text-white font-bold hover:bg-blue-700"
            />
            <span className="text-gray-600 dark:text-gray-300 font-medium">
              Page {page} of {totalPages}
            </span>
            <Button
              text="Next"
              handleClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              classes="bg-blue-600 text-white font-bold hover:bg-blue-700"
            />
          </div>
        </>
      )}
    </section>
  );
}
