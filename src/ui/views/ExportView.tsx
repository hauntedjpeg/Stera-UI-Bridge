import { useCallback, useState } from "react";
import type { GenerateResult } from "../../core/css/generate.js";

type Props = {
  output: GenerateResult;
};

export function ExportView({ output }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(output.css);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [output.css]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([output.css], { type: "text/css" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "globals.css";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [output.css]);

  if (output.errors.length > 0) {
    return (
      <div className="p-4">
        <div className="mb-2 font-semibold text-[var(--color-danger)]">
          Cannot export
        </div>
        <ul className="list-inside list-disc">
          {output.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2">
        <button
          onClick={handleCopy}
          className="rounded border border-[var(--color-border)] px-3 py-1.5 font-medium hover:bg-[var(--color-surface-secondary)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={handleDownload}
          className="rounded bg-[var(--color-brand)] px-3 py-1.5 font-semibold text-[var(--color-brand-text)]"
        >
          Download globals.css
        </button>
      </div>
      <pre className="flex-1 overflow-auto bg-[var(--color-surface-secondary)] p-3 font-mono text-[10px] leading-relaxed">
        {output.css}
      </pre>
    </div>
  );
}
