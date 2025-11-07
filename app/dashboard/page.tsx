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
        return router.replace(data.role === "shop_admin" ? "/profile/shop" : "/profile/user");
      }
      router.replace(data.role === "shop_admin" ? "/shop/dashboard" : "/user/dashboard");
    });
    return () => unsub();
  }, [router]);

  return <div className="p-8 text-center">Loading...</div>;
}
