"use client";

import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { normalizeRedirectParam, redirectAfterAuth } from "@/lib/auth-client-redirect";
import { useSearchParams } from "next/navigation";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, login, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const redirect = normalizeRedirectParam(searchParams.get("redirect"));

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      redirectAfterAuth(redirect);
    }
  }, [user, isLoading, redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    redirectAfterAuth(redirect);
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
      <div className="border-b border-brand-100/80 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-8 py-8 text-center dark:border-white/5">
        <Image
          src="/logo/logo%20abaarso.png"
          alt="Abaarso Tech University"
          width={120}
          height={120}
          className="mx-auto h-28 w-28 rounded-2xl bg-white/95 object-contain p-2 shadow-lg"
          priority
        />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Abaarso Tech University
        </h1>
        <p className="mt-1.5 text-sm text-brand-100/90">
          Sign in to continue to your dashboard
        </p>
      </div>

      <div className="px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="rounded-lg bg-error-500/10 px-3 py-2 text-sm text-error-500">
              {error}
            </p>
          )}

          <div>
            <Label>
              Email <span className="text-error-500">*</span>
            </Label>
            <Input
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <Label>
              Password <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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

          <Button className="w-full" size="sm" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
