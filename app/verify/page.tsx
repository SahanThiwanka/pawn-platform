"use client";

import { auth } from "../lib/firebase.client";
import { sendEmailVerification } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { actionCodeSettings } from "../lib/verification";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    setErr(null);
    setMsg(null);
    const u = auth.currentUser;
    if (!u) return router.replace("/login");

    try {
      setLoading(true);
      await sendEmailVerification(u, actionCodeSettings);
      setMsg("Verification email sent! Please check your inbox.");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const iveVerified = async () => {
    const u = auth.currentUser;
    if (!u) return router.replace("/login");
    await u.reload();
    if (u.emailVerified) return router.replace("/dashboard");
    setErr("Still not verified. Click the link in your email, then try again.");
  };

  return (
    <div className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-gray-950 text-gray-100">
      {/* Gradient glow background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      {/* Glass container */}
      <main className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-gray-900/70 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600/20 ring-1 ring-white/10">
            <span className="text-2xl">💌</span>
          </div>
          <h1 className="text-xl font-semibold">Verify your email</h1>
          <p className="mt-2 text-center text-sm text-gray-400">
            We’ve sent a verification link to your email.
            <br />
            Click it to continue.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={resend}
            disabled={loading}
            className="flex-1 rounded-full border border-white/10 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-700 disabled:opacity-60"
          >
            {loading ? "Sending…" : "Resend email"}
          </button>
          <button
            onClick={iveVerified}
            className="flex-1 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:translate-y-[-1px] hover:shadow-xl"
          >
            I’ve verified
          </button>
        </div>

        {msg && (
          <p className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-center text-sm text-green-300">
            {msg}
          </p>
        )}
        {err && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
            {err}
          </p>
        )}
      </main>

      <footer className="relative z-10 mt-6 text-xs text-gray-500">
        Didn’t get the email? Check your spam folder.
      </footer>
    </div>
  );
}
