"use client";

import { auth, db } from "../lib/firebase.client";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardRouter() {
  const router = useRouter();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();

      if (!u.emailVerified) return router.replace("/verify");

      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.data();

      if (!data?.role) return router.replace("/register");

      if (!data.profileCompleted) {
        return router.replace(
          data.role === "shop_admin" ? "/profile/shop" : "/profile/user"
        );
      }

      router.replace(
        data.role === "shop_admin" ? "/shop/dashboard" : "/user/dashboard"
      );
    });

    return () => unsub();
  }, [router]);

  return (
    <div className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-gray-950 text-gray-100">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-20 blur-3xl" />

      {/* Glow ring effect */}
      <div className="absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-indigo-600/20 blur-[100px]" />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="mb-6 h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        <h1 className="text-lg font-medium text-gray-200">
          Redirecting to your dashboard…
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Checking verification and role status
        </p>
      </div>
    </div>
  );
}
