"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MyCollateralPage() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const qCol = query(
        collection(db, "collaterals"),
        where("userUid", "==", u.uid),
        limit(200)
      );
      const res = await getDocs(qCol);
      setRows(res.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const available = useMemo(
    () => rows.filter((r) => r.status === "available"),
    [rows]
  );
  const pledged = useMemo(
    () => rows.filter((r) => r.status === "pledged" || r.status === "loan_active"),
    [rows]
  );

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading your jewelry…
        </div>
      </div>
    );

  const Section = ({ title, items }: { title: string; items: any[] }) => (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">No items.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((c) => (
            <div
              key={c.id}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gray-900/60 p-4 backdrop-blur-md transition hover:shadow-[0_0_20px_-5px_rgba(56,189,248,0.3)]"
            >
              <div className="flex flex-col space-y-2">
                <div className="font-semibold text-gray-100 group-hover:text-cyan-300 transition">
                  {c.title || "Untitled Jewelry"}
                </div>
                <div className="text-xs text-gray-400">
                  Est. Value:{" "}
                  <span className="font-medium text-gray-200">
                    {Number(c.estimatedValue || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Link
                    href={`/user/loan-requests/new?collateralId=${c.id}`}
                    className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-200 hover:bg-cyan-500/20 hover:border-cyan-400/60 transition"
                  >
                    Request Loan
                  </Link>
                  {c.status === "loan_active" && (
                    <span className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-300">
                      In Loan
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-6xl p-6 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
            My Jewelry
          </h1>
          <Link
            href="/user/collateral/new"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
          >
            + Add Jewelry
          </Link>
        </div>

        <Section title="Available" items={available} />
        <Section title="Pledged / Active" items={pledged} />
      </main>
    </div>
  );
}
