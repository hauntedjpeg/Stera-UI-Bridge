import { useCallback, useMemo, useState } from "react";
import type { GenerateResult } from "../../core/css/generate.js";
import { generateRawJson } from "../../core/json/export.js";
import type { RawVariablesPayload } from "../../shared/messages.js";

type Format = "css" | "json";

type Props = {
  output: GenerateResult;
  raw: RawVariablesPayload | null;
  fileName: string;
};

function sanitizeFileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "figma";
  return trimmed.replace(/[\/\\:*?"<>|]+/g, "-");
}

export function ExportView({ output, raw, fileName }: Props) {
  const [format, setFormat] = useState<Format>("css");
  const [copied, setCopied] = useState(false);

  const json = useMemo(() => (raw ? generateRawJson(raw) : ""), [raw]);

  const cssBlocked = format === "css" && output.errors.length > 0;
  const text = format === "css" ? output.css : json;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  const handleDownload = useCallback(() => {
    const isCss = format === "css";
    const blob = new Blob([text], {
      type: isCss ? "text/css" : "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isCss
      ? "globals.css"
      : `${sanitizeFileName(fileName)}-variables.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [format, text, fileName]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2">
        <div className="flex rounded border border-[var(--color-border)] text-[11px]">
          <button
            onClick={() => setFormat("css")}
            className={`px-2 py-1 ${
              format === "css"
                ? "bg-[var(--color-surface-secondary)] font-semibold"
                : ""
            }`}
          >
            CSS
          </button>
          <button
            onClick={() => setFormat("json")}
            className={`px-2 py-1 ${
              format === "json"
                ? "bg-[var(--color-surface-secondary)] font-semibold"
                : ""
            }`}
          >
            JSON
          </button>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleCopy}
          disabled={cssBlocked || !text}
          className="rounded border border-[var(--color-border)] px-3 py-1.5 font-medium hover:bg-[var(--color-surface-secondary)] disabled:opacity-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={handleDownload}
          disabled={cssBlocked || !text}
          className="rounded bg-[var(--color-brand)] px-3 py-1.5 font-semibold text-[var(--color-brand-text)] disabled:opacity-50"
        >
          {format === "css" ? "Download globals.css" : "Download JSON"}
        </button>
      </div>

      {cssBlocked ? (
        <div className="p-4">
          <div className="mb-2 font-semibold text-[var(--color-danger)]">
            Cannot export CSS
          </div>
          <ul className="list-inside list-disc">
            {output.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : (
        <pre className="flex-1 overflow-auto bg-[var(--color-surface-secondary)] p-3 font-mono text-[10px] leading-relaxed">
          {text}
        </pre>
      )}
    </div>
  );
}
