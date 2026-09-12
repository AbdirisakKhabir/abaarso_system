"use client";

import Swal from "sweetalert2";

function isDarkMode(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

const BRAND = "#465fff";
const DANGER = "#d92d20";
const NEUTRAL = "#6b7280";

/** Yes/No confirmation dialog. Resolves true when the user confirms. */
export async function confirmYesNo(options: {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: "warning" | "question" | "info" | "success" | "error";
  /** Use the danger (red) color for the confirm button — for destructive actions. */
  danger?: boolean;
}): Promise<boolean> {
  const dark = isDarkMode();
  const result = await Swal.fire({
    title: options.title,
    text: options.text,
    icon: options.icon ?? "warning",
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Yes",
    cancelButtonText: options.cancelText ?? "No",
    confirmButtonColor: options.danger ? DANGER : BRAND,
    cancelButtonColor: NEUTRAL,
    reverseButtons: true,
    focusCancel: true,
    background: dark ? "#1e2635" : "#ffffff",
    color: dark ? "#e5e7eb" : "#1f2937",
  });
  return result.isConfirmed;
}

export async function notifySuccess(title: string, text?: string): Promise<void> {
  const dark = isDarkMode();
  await Swal.fire({
    title,
    text,
    icon: "success",
    confirmButtonColor: BRAND,
    background: dark ? "#1e2635" : "#ffffff",
    color: dark ? "#e5e7eb" : "#1f2937",
    timer: 2200,
    showConfirmButton: false,
  });
}

export async function notifyError(title: string, text?: string): Promise<void> {
  const dark = isDarkMode();
  await Swal.fire({
    title,
    text,
    icon: "error",
    confirmButtonColor: BRAND,
    background: dark ? "#1e2635" : "#ffffff",
    color: dark ? "#e5e7eb" : "#1f2937",
  });
}
