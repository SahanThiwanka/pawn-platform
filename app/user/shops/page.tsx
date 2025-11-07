"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Row = { id: string; name: string; status: string };

export default function UserShopsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");
      const me = await getDoc(doc(db, "users", u.uid));
      if (me.data()?.role !== "user") return router.replace("/dashboard");

      const q = query(collection(db, "memberships"), where("userId", "==", u.uid));
      const ms = await getDocs(q);

      const out: Row[] = [];
      for (const m of ms.docs) {
        const d = m.data();
        const sSnap = await getDoc(doc(db, "shops", d.shopId));
        const s = sSnap.data() || {};
        out.push({ id: d.shopId, name: s.shopName || "Shop", status: d.status || "active" });
      }
      setRows(out);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading shops…
        </div>
      </div>
    );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Shops</h1>
          <Link
            href="/user/shops/join"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Join a Shop
          </Link>
        </div>

        <section className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 text-gray-300">
              <tr className="border-b border-white/10">
                <th className="p-3 text-left font-semibold uppercase tracking-wide text-xs">Shop</th>
                <th className="p-3 text-left font-semibold uppercase tracking-wide text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/10 hover:bg-gray-800/40 transition">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3">
                    <StatusChip status={r.status} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-gray-400" colSpan={2}>
                    No shops yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    suspended: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
  };
  const cls =
    map[status?.toLowerCase?.()] ||
    "bg-gray-500/20 text-gray-300 ring-1 ring-gray-500/30";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${cls}`}>
      {status}
    </span>
  );
}
