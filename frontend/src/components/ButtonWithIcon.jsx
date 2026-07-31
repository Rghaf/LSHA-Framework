export default function ButtonWithIcon({ text, icon, classes, href, target }) {
  return (
    <div className="mt-10">
      <a
        href={href || "#"}
        target={target || "_self"}
        className={`inline-flex items-center justify-center px-5 py-4 border border-transparent text-xl font-semibold rounded-full shadow-lg ${classes} transition-all duration-300 transform hover:-translate-y-1 hover:scale-101`}>
        {text}
        <span className="ml-2">{icon}</span>
      </a>
    </div>
  );
}
