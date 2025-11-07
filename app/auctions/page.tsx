"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase.client";
import Link from "next/link";
import { toDateAny } from "../lib/auction";

type A = {
  id: string;
  title: string;
  images?: string[];
  status: "live" | "scheduled" | "ended" | string;
  startAt?: any;
  endAt?: any;
  startPrice?: number;
};

export default function AuctionsListPage() {
  const [live, setLive] = useState<A[]>([]);
  const [sched, setSched] = useState<A[]>([]);
  const [ended, setEnded] = useState<A[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const liveQ = query(
        collection(db, "auctions"),
        where("status", "==", "live"),
        orderBy("endAt", "asc"),
        limit(20)
      );
      const schedQ = query(
        collection(db, "auctions"),
        where("status", "==", "scheduled"),
        orderBy("startAt", "asc"),
        limit(20)
      );
      const endedQ = query(
        collection(db, "auctions"),
        where("status", "==", "ended"),
        orderBy("endAt", "desc"),
        limit(10)
      );

      const [lS, sS, eS] = await Promise.all([
        getDocs(liveQ),
        getDocs(schedQ),
        getDocs(endedQ),
      ]);

      setLive(lS.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setSched(sS.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setEnded(eS.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />
        <main className="relative z-10 mx-auto max-w-6xl p-6 space-y-8">
          <h1 className="text-3xl font-bold">Auctions</h1>
          <SkeletonSection />
          <SkeletonSection />
          <SkeletonSection />
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-6xl p-6 space-y-8">
        <h1 className="text-3xl font-bold">Auctions</h1>
        <Section title="Live" items={live} />
        <Section title="Scheduled" items={sched} />
        <Section title="Recently Ended" items={ended} />
      </main>
    </div>
  );
}

/* ---------- UI Parts ---------- */

function Section({ title, items }: { title: string; items: A[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">No items.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((a) => (
            <AuctionCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </section>
  );
}

function AuctionCard({ a }: { a: A }) {
  const start = toDateAny(a.startAt);
  const end = toDateAny(a.endAt);
  const cover = a.images?.[0] ?? null;

  return (
    <Link
      href={`/auctions/${a.id}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 transition"
    >
      <div className="relative h-40 w-full overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt={a.title || "Auction"}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-gray-800 to-gray-700 grid place-items-center">
            <span className="text-xs text-gray-400">No image</span>
          </div>
        )}
        <div className="absolute left-2 top-2">
          <StatusBadge status={a.status} />
        </div>
      </div>

      <div className="p-4 space-y-2">
        <div className="line-clamp-1 font-medium">{a.title || "Auction"}</div>
        <div className="text-xs text-gray-400">
          {a.status === "scheduled" && start && `Starts: ${start.toLocaleString()}`}
          {a.status === "live" && end && `Ends: ${end.toLocaleString()}`}
          {a.status === "ended" && end && `Ended: ${end.toLocaleString()}`}
        </div>
        {typeof a.startPrice === "number" && (
          <div className="text-sm text-gray-300">
            Start: <span className="font-semibold">{fmtLKR(a.startPrice)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    {
      live: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
      scheduled: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
      ended: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    }[status?.toLowerCase?.()] || "bg-gray-600/15 text-gray-300 ring-1 ring-gray-600/30";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

/* ---------- Helpers ---------- */

function fmtLKR(n?: number) {
  if (typeof n !== "number") return "";
  try {
    return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

/* ---------- Skeletons ---------- */

function SkeletonSection() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-44 rounded bg-white/10 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md">
      <div className="h-40 w-full bg-white/5 animate-pulse" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
        <div className="h-3 w-1/3 bg-white/10 rounded animate-pulse" />
      </div>
    </div>
  );
}
