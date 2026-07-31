import Header from "./Header";

export default function Container({ children }) {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-200 dark:from-slate-900 dark:to-slate-800 text-gray-800 dark:text-gray-100 min-h-screen">
      <Header />
      <main className="pt-24">{children}</main>
    </div>
  );
}
