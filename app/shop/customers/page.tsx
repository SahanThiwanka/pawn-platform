"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Row = { id: string; displayName: string; email: string; status: string };

export default function ShopCustomersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const user = userSnap.data();
      if (user?.role !== "shop_admin" || !user.shopId) return router.replace("/dashboard");
      setShopId(user.shopId);

      // fetch members
      const q = query(collection(db, "memberships"), where("shopId", "==", user.shopId));
      const ms = await getDocs(q);

      const out: Row[] = [];
      for (const m of ms.docs) {
        const d = m.data();
        const userSnap = await getDoc(doc(db, "users", d.userId));
        const udata = userSnap.data() || {};
        out.push({
          id: d.userId,
          displayName: udata.displayName || "Unknown",
          email: udata.email || "",
          status: d.status || "active",
        });
      }
      setRows(out);

      // join code if exists
      if (user.shopId) {
        const sSnap = await getDoc(doc(db, "shops", user.shopId));
        setCode(sSnap.data()?.joinCode ?? null);
      }
    });
    return () => unsub();
  }, [router]);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shop Customers</h1>
        <Link href="/shop/customers/add" className="rounded-lg bg-black text-white px-4 py-2">
          Add Customer
        </Link>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.displayName}</td>
                <td className="p-3">{r.email}</td>
                <td className="p-3">{r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-4 text-gray-500" colSpan={3}>No customers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {shopId && (
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold mb-2">Share Join Code</h2>
          <p className="text-gray-600 text-sm">
            Ask customers to go to <code>/user/shops/join</code> and enter this code:
          </p>
          <p className="text-2xl font-mono mt-2">{code ?? "No code set"}</p>
          <Link href="/shop/customers/add" className="underline text-sm mt-2 inline-block">
            Generate/Refresh code on “Add Customer” page
          </Link>
        </div>
      )}
    </main>
  );
}
