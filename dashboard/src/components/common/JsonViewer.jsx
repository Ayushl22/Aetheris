import { useState } from "react";
import Icon from "./Icon";
import { safeJson } from "../../utils/formatters";

export default function JsonViewer({ value, label = "JSON data", tone = "default" }) {
  const [copied, setCopied] = useState(false);
  const content = safeJson(value);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`json-viewer json-viewer-${tone}`}>
      <div className="json-toolbar">
        <span>{label}</span>
        <button type="button" onClick={copy} aria-label={`Copy ${label}`}>
          <Icon name="copy" size={13} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="json-scroll" tabIndex={0}>
        <pre>{content}</pre>
      </div>
    </div>
  );
}
