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

  const resend = async () => {
    setErr(null); setMsg(null);
    const u = auth.currentUser;
    if (!u) return router.replace("/login");
    try {
      await sendEmailVerification(u, actionCodeSettings);
      setMsg("Verification email sent. Please check your inbox.");
    } catch (e:any) { setErr(e.message); }
  };

  const iveVerified = async () => {
    const u = auth.currentUser;
    if (!u) return router.replace("/login");
    await u.reload();
    if (u.emailVerified) return router.replace("/dashboard");
    setErr("Still not verified. Please click the link in your email, then try again.");
  };

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Verify your email</h1>
      <p className="text-gray-600">We’ve sent a verification link to your email. Click it to continue.</p>
      <div className="flex gap-3">
        <button onClick={resend} className="rounded-lg border px-4 py-2">Resend email</button>
        <button onClick={iveVerified} className="rounded-lg bg-black text-white px-4 py-2">I’ve verified</button>
      </div>
      {msg && <p className="text-green-600 text-sm">{msg}</p>}
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </main>
  );
}
