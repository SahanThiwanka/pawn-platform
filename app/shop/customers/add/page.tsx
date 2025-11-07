"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase.client";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ensureJoinCode } from "../../../lib/shop";

export default function ShopCustomersAddPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const user = userSnap.data();
      if (user?.role !== "shop_admin" || !user.shopId)
        return router.replace("/dashboard");
      setShopId(user.shopId);
      const code = await ensureJoinCode(user.shopId);
      setJoinCode(code);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const addByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (!shopId) return;

    const q = query(collection(db, "users"), where("email", "==", email));
    const res = await getDocs(q);

    if (!res.empty) {
      const userDoc = res.docs[0];
      await addDoc(collection(db, "memberships"), {
        userId: userDoc.id,
        shopId,
        status: "active",
        createdBy: "shop",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setStatus("Linked existing user as customer.");
      return;
    }

    await addDoc(collection(db, "invites"), {
      email,
      shopId,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    setStatus(
      "Invite created. When the user registers with this email, they can accept it."
    );
  };

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading shop info…
        </div>
      </div>
    );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* glowing gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-xl p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Add Customer</h1>
          <Link
            href="/shop/customers"
            className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm hover:bg-indigo-600 hover:text-white transition"
          >
            Back
          </Link>
        </div>

        {/* Add by Email */}
        <form
          onSubmit={addByEmail}
          className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-5 space-y-4"
        >
          <h2 className="font-semibold text-lg">Add by Email</h2>
          <input
            type="email"
            className="w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Customer email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            className="w-full rounded-lg bg-indigo-600 text-white px-4 py-2 hover:opacity-90 transition"
            type="submit"
          >
            Add
          </button>
        </form>

        {status && (
          <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {status}
          </p>
        )}

        {/* Join by Code */}
        <section className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-5 space-y-3">
          <h2 className="font-semibold text-lg">Join by Code</h2>
          <p className="text-gray-400 text-sm">
            Share this code with customers:
          </p>
          <p className="text-3xl font-mono tracking-widest text-cyan-400">
            {joinCode ?? "…"}
          </p>
          <p className="text-gray-500 text-xs">
            Customers go to <code>/user/shops/join</code> and enter this code.
          </p>
        </section>
      </main>
    </div>
  );
}
