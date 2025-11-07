"use client";

import { auth, googleProvider, db } from "../lib/firebase.client";
import { signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { actionCodeSettings } from "../lib/verification";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ensureUserDoc = async (uid: string) => {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        role: null,
        profileCompleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return (await getDoc(ref)).data()!;
  };

  const routeByState = async () => {
    const u = auth.currentUser!;
    await u.reload();
    if (!u.emailVerified) {
      await sendEmailVerification(u, actionCodeSettings);
      return router.replace("/verify");
    }
    const snap = await getDoc(doc(db, "users", u.uid));
    const data = snap.data();
    if (!data?.role) return router.replace("/register");
    if (!data.profileCompleted)
      return router.replace(
        data.role === "shop_admin" ? "/profile/shop" : "/profile/user"
      );
    return router.replace("/dashboard");
  };

  const loginGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await ensureUserDoc(cred.user.uid);
      await routeByState();
    } catch (e: any) {
      setError(e.message ?? "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const loginEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(cred.user.uid);
      await routeByState();
    } catch (e: any) {
      setError(e.message ?? "Email sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100svh]">
      {/* Brand gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25" />
      <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-white/10 blur-3xl" />

      {/* Centered card */}
      <main className="relative z-10 mx-auto grid min-h-[100svh] w-full place-items-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-gray-900/70 p-6 text-gray-100 shadow-2xl backdrop-blur-md md:p-8">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gray-800 ring-1 ring-white/10">
              <span className="text-xl">⚡</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Welcome back</h1>
              <p className="text-sm text-gray-400">Sign in to ePawning</p>
            </div>
          </div>

          {/* Google button */}
          <button
            onClick={loginGoogle}
            disabled={loading}
            className="group mb-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-100 transition hover:bg-gray-700 disabled:opacity-60"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-2">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-gray-400">or sign in with email</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Email form */}
          <form onSubmit={loginEmail} className="mt-2 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-gray-300">Email</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-gray-800 px-3 py-2 text-gray-100 outline-none ring-indigo-400/30 placeholder:text-gray-400 focus:ring"
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-gray-300">Password</span>
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-white/10 bg-gray-800 px-3 py-2 pr-10 text-gray-100 outline-none ring-indigo-400/30 placeholder:text-gray-400 focus:ring"
                  placeholder="••••••••"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPass ? "Hide password" : "Show password"}
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute inset-y-0 right-2 grid place-items-center rounded-md px-2 text-gray-400 hover:text-gray-200"
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </label>

            <div className="flex items-center justify-between pt-1 text-xs">
              <Link
                href="/forgot-password"
                className="text-gray-400 hover:text-gray-200 hover:underline"
              >
                Forgot password?
              </Link>
              <Link
                href="/register/user"
                className="text-gray-400 hover:text-gray-200 hover:underline"
              >
                Create account
              </Link>
            </div>

            <button
              className="mt-2 w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:translate-y-[-1px] hover:shadow-xl disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Login"}
            </button>
          </form>

          {error && (
            <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          {/* Footer helper */}
          <p className="mt-6 text-center text-xs text-gray-500">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-gray-300">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-gray-300">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}

/* --- Little inline Google SVG, no external libs --- */
function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.605 32.91 29.223 36 24 36c-6.627 0-12-5.373-12-12S17.373 12 24 12c3.059 0 5.842 1.154 7.965 3.035l5.657-5.657C33.69 6.053 29.085 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20c10.493 0 19.104-7.637 19.104-20 0-1.341-.144-2.651-.411-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.39 16.106 18.83 12 24 12c3.059 0 5.842 1.154 7.965 3.035l5.657-5.657C33.69 6.053 29.085 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.138 0 9.842-1.973 13.4-5.186l-6.186-5.238C29.162 35.484 26.73 36 24 36c-5.197 0-9.593-3.114-11.29-7.484l-6.52 5.022C9.5 40.02 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-1.408 4.11-5.36 7-11.303 7-5.197 0-9.593-3.114-11.29-7.484l-6.52 5.022C9.5 40.02 16.227 44 24 44c10.493 0 19.104-7.637 19.104-20 0-1.341-.144-2.651-.411-3.917z"
      />
    </svg>
  );
}
