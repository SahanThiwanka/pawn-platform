"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { auth } from "../../lib/firebase.client";

export default function VerifiedLanding() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(async () => {
      const u = auth.currentUser;
      if (u) await u.reload();
      router.replace("/dashboard");
    }, 800);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main className="max-w-md mx-auto p-6 text-center space-y-3">
      <h1 className="text-2xl font-bold">Email verified</h1>
      <p className="text-gray-600">Redirecting you to your dashboard…</p>
    </main>
  );
}
