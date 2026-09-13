import { statusClass } from "../../utils/formatters";

export default function StatusBadge({ status }) {
  return <span className={statusClass(status)}>{status || "UNKNOWN"}</span>;
}