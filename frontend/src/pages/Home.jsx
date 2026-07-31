import Banner from "../components/Banner";
import UploadBox from "../components/UploadBox";
import Button from "../components/Button";
import { MdArrowForward } from "@react-icons/all-files/md/MdArrowForward";

export default function Home() {
  return (
    <>
      <Banner />
      <section id="start-algorithm" className="py-20 bg-white dark:bg-slate-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-extrabold text-gray-800 dark:text-gray-100 mb-6">
            Start using the Algorithm
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Dive into the world of L*sha by customizing the algorithm or easily
            uploading your data.
          </p>
          <Button
            text="Start Customizing the Algorithm"
            link="/form"
            classes="bg-indigo-600 text-white font-bold hover:bg-indigo-700 hover:scale-105"
          />
          <p className="text-xl font-medium text-gray-600 dark:text-gray-300 mb-8">OR</p>
          <UploadBox />
        </div>
      </section>
    </>
  );
}
