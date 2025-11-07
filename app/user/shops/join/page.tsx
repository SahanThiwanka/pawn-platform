"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase.client";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UserJoinShopPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");
      const me = await getDoc(doc(db, "users", u.uid));
      if (me.data()?.role !== "user") return router.replace("/dashboard");
    });
    return () => unsub();
  }, [router]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const u = auth.currentUser;
    if (!u) return router.replace("/login");

    // find shop with this joinCode
    const q = query(collection(db, "shops"), where("joinCode", "==", code.trim()));
    const res = await getDocs(q);
    if (res.empty) return setMsg("Invalid code.");

    const shopId = res.docs[0].id;

    // create ACTIVE membership
    await addDoc(collection(db, "memberships"), {
      userId: u.uid,
      shopId,
      status: "active",
      createdBy: "user",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setMsg("Joined! Redirecting…");
    setTimeout(() => router.replace("/user/shops"), 700);
  };

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Join a Shop</h1>
      <form onSubmit={join} className="space-y-3">
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Enter 6-digit code"
          value={code}
          onChange={(e)=>setCode(e.target.value)}
        />
        <button className="rounded-lg bg-black text-white px-4 py-2">Join</button>
      </form>
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      <Link href="/user/shops" className="underline text-sm">Back to my shops</Link>
    </main>
  );
}
