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
  const [loading, setLoading] = useState(true);

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

      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading customers…
        </div>
      </div>
    );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-5xl p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Shop Customers</h1>
          <Link
            href="/shop/customers/add"
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 hover:opacity-90 transition"
          >
            Add Customer
          </Link>
        </div>

        {/* Customers table */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/70 text-gray-300">
              <tr>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-white/5 hover:bg-gray-800/50 transition"
                >
                  <td className="p-3">{r.displayName}</td>
                  <td className="p-3 text-gray-400">{r.email}</td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    className="p-4 text-center text-gray-500"
                    colSpan={3}
                  >
                    No customers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Join code */}
        {shopId && (
          <section className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-5 space-y-3">
            <h2 className="font-semibold text-lg">Share Join Code</h2>
            <p className="text-gray-400 text-sm">
              Ask customers to go to <code>/user/shops/join</code> and enter this code:
            </p>
            <p className="text-3xl font-mono tracking-widest text-cyan-400">
              {code ?? "No code set"}
            </p>
            <Link
              href="/shop/customers/add"
              className="underline text-sm text-indigo-400 hover:text-indigo-300"
            >
              Generate/Refresh code on “Add Customer” page
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    inactive: "bg-gray-500/15 text-gray-300 ring-1 ring-gray-500/30",
    pending: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  };
  const cls =
    map[status?.toLowerCase?.()] ||
    "bg-gray-600/15 text-gray-300 ring-1 ring-gray-600/30";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}
