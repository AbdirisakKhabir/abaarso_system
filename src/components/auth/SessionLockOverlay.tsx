"use client";

import React from "react";
import { ShieldOff } from "lucide-react";
import Button from "@/components/ui/button/Button";

type SessionLockOverlayProps = {
  onSignInAgain: () => void;
};

/** Blocks all interaction after 1 hour of inactivity. */
export default function SessionLockOverlay({ onSignInAgain }: SessionLockOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-950/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-lock-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-white p-8 text-center shadow-2xl dark:bg-gray-900">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/15">
          <ShieldOff className="h-8 w-8 text-amber-700 dark:text-amber-400" strokeWidth={1.75} />
        </div>
        <h2
          id="session-lock-title"
          className="text-xl font-semibold text-gray-900 dark:text-white"
        >
          Session inactive
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          You have been inactive for one hour. For security, the system is locked until you sign in
          again. Unsaved work in open forms is kept as drafts where supported.
        </p>
        <Button className="mt-6 w-full" onClick={onSignInAgain}>
          Sign in again
        </Button>
      </div>
    </div>
  );
}
