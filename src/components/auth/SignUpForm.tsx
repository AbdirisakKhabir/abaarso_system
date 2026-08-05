"use client";

import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { redirectAfterAuth } from "@/lib/auth-client-redirect";

export default function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, isLoading, login } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      redirectAfterAuth("/");
    }
  }, [user, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError("All fields are required.");
      return;
    }
    if (!isChecked) {
      setError("Please accept terms, conditions and privacy policy.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign up failed.");
        return;
      }

      const loginResult = await login(email.trim(), password);
      if (loginResult.error) {
        setError(loginResult.error);
        return;
      }
      redirectAfterAuth("/");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || user) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-white/60 bg-white/80 px-6 py-10 shadow-xl shadow-brand-900/5 backdrop-blur-md dark:border-white/10 dark:bg-gray-900/80">
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-[0_24px_80px_-24px_rgba(42,49,216,0.35)] backdrop-blur-md dark:border-white/10 dark:bg-gray-900/90 dark:shadow-black/40">
      <div className="border-b border-brand-100/80 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-8 py-7 text-center dark:border-white/5">
        <Image
          src="/logo/logo%20abaarso.png"
          alt="Abaarso Tech University"
          width={64}
          height={64}
          className="mx-auto h-14 w-14 rounded-xl bg-white/95 object-contain p-1.5 shadow-lg"
          priority
        />
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Create account
        </h1>
        <p className="mt-1.5 text-sm text-brand-100/90">
          Join Abaarso Tech University
        </p>
      </div>

      <div className="max-h-[min(70vh,640px)] overflow-y-auto px-8 py-7">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-error-500/10 px-3 py-2 text-sm text-error-500">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>
                First Name<span className="text-error-500">*</span>
              </Label>
              <Input
                type="text"
                id="fname"
                name="fname"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div>
              <Label>
                Last Name<span className="text-error-500">*</span>
              </Label>
              <Input
                type="text"
                id="lname"
                name="lname"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div>
            <Label>
              Email<span className="text-error-500">*</span>
            </Label>
            <Input
              type="email"
              id="email"
              name="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <Label>
              Password<span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input
                placeholder="At least 6 characters"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 z-30 -translate-y-1/2 cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                ) : (
                  <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              className="mt-0.5 h-5 w-5"
              checked={isChecked}
              onChange={setIsChecked}
            />
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
              I agree to the{" "}
              <span className="text-gray-800 dark:text-white/90">Terms and Conditions</span>{" "}
              and{" "}
              <span className="text-gray-800 dark:text-white">Privacy Policy</span>
            </p>
          </div>

          <Button className="w-full" size="sm" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <Link
            href="/signin"
            className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
