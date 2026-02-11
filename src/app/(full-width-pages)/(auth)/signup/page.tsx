import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Abaarso Tech University - Sign Up",
  description: "Sign up for Abaarso Tech University",
};

export default function SignUp() {
  return <SignUpForm />;
}
