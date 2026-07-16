import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { addFaq } from "~/domains/library";
import { decodeFaqBytes } from "~/lib/encoding";
import { parseFaqFilename } from "~/lib/filename";

// File-input import (no server). Decodes each file, saves to IndexedDB, and — for a
// single file — opens it. The library list updates reactively via useLiveQuery.
export function ImportButton({ className = "" }: { className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      let lastId = "";
      for (const file of files) {
        const buf = await file.arrayBuffer();
        const { text, encoding, repaired } = decodeFaqBytes(buf);
        const { title } = parseFaqFilename(file.name);
        lastId = await addFaq({
          title,
          source: file.name,
          text,
          byteSize: file.size,
          encoding,
          repaired,
        });
      }
      if (files.length === 1 && lastId) navigate(`/faq/${lastId}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <label
      className={`inline-flex cursor-pointer items-center justify-center rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 active:bg-neutral-300 ${className}`}
    >
      {busy ? "Adding…" : "Add FAQ"}
      <input
        ref={inputRef}
        type="file"
        accept=".txt,text/plain"
        multiple
        className="hidden"
        onChange={onChange}
        disabled={busy}
      />
    </label>
  );
}
