import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Abaarso Tech University - Sign In",
  description: "Sign in to Abaarso Tech University",
};

export default function SignIn() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center"><span className="text-gray-500">Loading...</span></div>}>
      <SignInForm />
    </Suspense>
  );
}
