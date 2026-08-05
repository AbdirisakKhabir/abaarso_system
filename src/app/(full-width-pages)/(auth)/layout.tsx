import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import { ThemeProvider } from "@/context/ThemeContext";
import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
        {/* Atmosphere */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-200/70 via-brand-50 to-slate-100 dark:from-brand-950 dark:via-gray-950 dark:to-gray-900"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-brand-400/25 blur-3xl dark:bg-brand-600/20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-blue-light-400/20 blur-3xl dark:bg-brand-500/15"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23101828' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative z-10 w-full max-w-[440px]">{children}</div>

        <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </ThemeProvider>
  );
}
