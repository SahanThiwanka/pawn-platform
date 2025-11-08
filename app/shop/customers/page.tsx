"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase.client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
} from "firebase/firestore";

export default function ShopCustomersPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const me = await getDoc(doc(db, "users", u.uid));
      const my = me.data() as any;
      if (my?.role !== "shop_admin" || !my.shopId) {
        return router.replace("/dashboard");
      }
      setShopId(my.shopId);

      const res = await getDocs(
        query(collection(db, "shops", my.shopId, "customers"), limit(500))
      );
      setRows(res.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading)
    return <div className="p-8 text-center text-gray-400">Loading…</div>;

  return (
    <main className="relative max-w-6xl mx-auto p-6 space-y-8 text-gray-100">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/20 via-cyan-400/10 to-transparent opacity-40 blur-3xl" />

      {/* Header */}
      <div className="relative flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
          Customers
        </h1>
        <Link
          href="/shop/customers/new"
          className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 font-medium transition"
        >
          Add Customer
        </Link>
      </div>

      {/* Table */}
      <div className="relative rounded-xl border border-white/10 bg-gray-900/40 backdrop-blur-sm overflow-hidden shadow-lg">
        <table className="w-full text-sm text-gray-200">
          <thead className="bg-gray-800/60 text-gray-300">
            <tr>
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">NIC</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Phone</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                className="border-t border-white/10 hover:bg-white/5 transition"
              >
                <td className="p-3">{c.fullName || "—"}</td>
                <td className="p-3">{c.nicNumber || "—"}</td>
                <td className="p-3">{c.email || "—"}</td>
                <td className="p-3">{c.phone || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  className="p-4 text-center text-gray-500"
                  colSpan={4}
                >
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
