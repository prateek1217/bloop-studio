"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import UploadFlow from "./UploadFlow";

interface Props {
  className: string;
  children: React.ReactNode;
}

/**
 * Renders as whatever trigger element `children`/`className` describe, but
 * clicking it opens the OS file picker immediately (no page navigation to
 * /new) — the file input's .click() has to happen synchronously inside this
 * component's own onClick to count as a user gesture, so the modal (with the
 * rest of the upload flow) only appears once a file is actually chosen.
 */
export default function UploadTrigger({ className, children }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  return (
    <>
      <button type="button" className={className} onClick={() => inputRef.current?.click()}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setFile(f);
          e.target.value = "";
        }}
      />

      {file &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
            onClick={() => setFile(null)}
          >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
              <UploadFlow initialFile={file} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
