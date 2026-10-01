"use client";

import React, { useState } from "react";

type Kind = "pdf" | "image" | "other";

export function documentKind(url: string): Kind {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|webp|gif)$/.test(path)) return "image";
  return "other";
}

/** Inline viewer for an uploaded document (PDF or image). */
export function DocumentFrame({ url }: { url: string }) {
  const kind = documentKind(url);
  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="Supporting document"
        className="mx-auto max-h-[70vh] w-auto rounded-lg border border-gray-200 dark:border-gray-700"
      />
    );
  }
  if (kind === "pdf") {
    return (
      <iframe
        src={url}
        title="Supporting document"
        className="h-[70vh] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700"
      />
    );
  }
  return (
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Preview is not available for this file type. Use &ldquo;Open in new tab&rdquo;.
    </p>
  );
}

/** Show / hide toggle for an uploaded document, with an "Open in new tab" link. */
export default function DocumentPreview({
  url,
  defaultOpen = false,
}: {
  url: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          {open ? "Hide document" : "Show document"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-500 hover:underline dark:text-gray-400"
        >
          Open in new tab
        </a>
      </div>
      {open && (
        <div className="mt-3">
          <DocumentFrame url={url} />
        </div>
      )}
    </div>
  );
}
