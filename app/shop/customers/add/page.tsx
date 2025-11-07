"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase.client";
import {
  addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where
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

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const user = userSnap.data();
      if (user?.role !== "shop_admin" || !user.shopId) return router.replace("/dashboard");
      setShopId(user.shopId);
      setJoinCode(await ensureJoinCode(user.shopId));
    });
    return () => unsub();
  }, [router]);

  const addByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (!shopId) return;

    // check if user exists
    const q = query(collection(db, "users"), where("email", "==", email));
    const res = await getDocs(q);

    if (!res.empty) {
      // user exists → create ACTIVE membership
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

    // user not found → create invite
    await addDoc(collection(db, "invites"), {
      email,
      shopId,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    setStatus("Invite created. When the user registers with this email, they can accept it.");
  };

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Add Customer</h1>
      <form onSubmit={addByEmail} className="space-y-3">
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Customer email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />
        <button className="rounded-lg bg-black text-white px-4 py-2">Add</button>
      </form>
      {status && <p className="text-sm text-green-600">{status}</p>}

      <div className="rounded-xl border p-4">
        <h2 className="font-semibold mb-2">Join by Code</h2>
        <p className="text-gray-600 text-sm">Share this code with customers:</p>
        <p className="text-2xl font-mono mt-2">{joinCode ?? "..."}</p>
        <p className="text-gray-500 text-xs mt-2">
          Customers go to <code>/user/shops/join</code> and enter this code.
        </p>
      </div>

      <Link href="/shop/customers" className="underline text-sm">Back to customers</Link>
    </main>
  );
}
