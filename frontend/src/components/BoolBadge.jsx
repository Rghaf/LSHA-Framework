import { MdDone } from "@react-icons/all-files/md/MdDone";
import { MdClear } from "@react-icons/all-files/md/MdClear";

export default function BoolBadge({ value }) {
  return value ? (
    <span className="inline-flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
      <MdDone /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold">
      <MdClear /> No
    </span>
  );
}
