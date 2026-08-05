import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Abaarso Tech University - Sign In",
  description: "Sign in to Abaarso Tech University",
};

export default function SignIn() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-white/60 bg-white/80 px-6 py-10 shadow-xl backdrop-blur-md">
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
