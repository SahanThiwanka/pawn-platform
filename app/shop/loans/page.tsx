"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Row = {
  id: string;
  customerEmail: string;
  status: string;
  outstandingPrincipal: number;
  accruedInterest: number;
  dueDate?: string;
};

export default function ShopLoansPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const me = await getDoc(doc(db, "users", u.uid));
      const my = me.data();
      if (my?.role !== "shop_admin" || !my.shopId) return router.replace("/dashboard");

      const qLoans = query(collection(db, "loans"), where("shopId", "==", my.shopId));
      const ls = await getDocs(qLoans);

      const out: Row[] = [];
      for (const d of ls.docs) {
        const loan = d.data();
        const cust = await getDoc(doc(db, "users", loan.customerUid));
        const email = cust.exists() ? (cust.data().email ?? "—") : "—";
        out.push({
          id: d.id,
          customerEmail: email,
          status: loan.status,
          outstandingPrincipal: Number(loan.outstandingPrincipal || 0),
          accruedInterest: Number(loan.accruedInterest || 0),
          dueDate: loan.dueDate
            ? new Date(loan.dueDate.seconds * 1000).toLocaleDateString()
            : undefined,
        });
      }
      setRows(out);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading loans…
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Shop Loans</h1>
          <Link
            href="/shop/dashboard"
            className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm text-gray-200 hover:bg-indigo-600 hover:text-white transition"
          >
            Back to Dashboard
          </Link>
        </div>

        <section className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 text-gray-300">
              <tr className="border-b border-white/10">
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">
                  Customer
                </th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">
                  Outstanding
                </th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">
                  Interest
                </th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">
                  Due
                </th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-white/10 hover:bg-gray-800/40 transition"
                >
                  <td className="p-3 font-mono text-xs text-gray-300">{r.customerEmail}</td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-3">{r.outstandingPrincipal.toFixed(2)}</td>
                  <td className="p-3 text-gray-300">{r.accruedInterest.toFixed(2)}</td>
                  <td className="p-3 text-gray-400">{r.dueDate ?? "—"}</td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/shop/loans/${r.id}`}
                      className="rounded-xl bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-400">
                    No loans yet.
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30 animate-pulse",
    settled: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    overdue: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
    default: "bg-gray-500/15 text-gray-300 ring-1 ring-gray-500/30",
  };
  const cls = map[status?.toLowerCase?.()] || map.default;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}
