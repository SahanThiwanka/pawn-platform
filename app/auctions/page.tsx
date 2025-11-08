"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "../lib/firebase.client";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  Timestamp,
} from "firebase/firestore";

function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
}

type Auction = {
  id: string;
  title?: string;
  images?: string[];
  status: "live" | "scheduled" | "ended" | string;
  startAt?: any;
  endAt?: any;
  startPrice?: number;
};

export default function AuctionsListPage() {
  const [live, setLive] = useState<Auction[]>([]);
  const [sched, setSched] = useState<Auction[]>([]);
  const [ended, setEnded] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const col = collection(db, "auctions");
        const [lS, sS, eS] = await Promise.all([
          getDocs(query(col, where("status", "==", "live"), limit(50))),
          getDocs(query(col, where("status", "==", "scheduled"), limit(50))),
          getDocs(query(col, where("status", "==", "ended"), limit(50))),
        ]);

        const mapDocs = (s: any[]) =>
          s.map((d) => ({ id: d.id, ...(d.data() as any) }));

        const liveRaw = mapDocs(lS.docs);
        const schedRaw = mapDocs(sS.docs);
        const endedRaw = mapDocs(eS.docs);

        liveRaw.sort(
          (a, b) =>
            (toDateAny(a.endAt)?.getTime() ?? 0) -
            (toDateAny(b.endAt)?.getTime() ?? 0)
        );
        schedRaw.sort(
          (a, b) =>
            (toDateAny(a.startAt)?.getTime() ?? 0) -
            (toDateAny(b.startAt)?.getTime() ?? 0)
        );
        endedRaw.sort(
          (a, b) =>
            (toDateAny(b.endAt)?.getTime() ?? 0) -
            (toDateAny(a.endAt)?.getTime() ?? 0)
        );

        setLive(liveRaw);
        setSched(schedRaw);
        setEnded(endedRaw);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading auctions…
        </div>
      </div>
    );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* background gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
            Auctions
          </h1>
          <Link
            href="/auctions/new"
            className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm hover:bg-indigo-600 hover:text-white transition"
          >
            + New Auction
          </Link>
        </div>

        <Section title="Live" items={live} />
        <Section title="Scheduled" items={sched} />
        <Section title="Recently Ended" items={ended} />
      </main>
    </div>
  );
}

/* ---------------- Section Component ---------------- */

function Section({ title, items }: { title: string; items: Auction[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-200">{title}</h2>
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

/* ---------------- Card Component ---------------- */

function AuctionCard({ a }: { a: Auction }) {
  const date =
    a.status === "scheduled"
      ? toDateAny(a.startAt)?.toLocaleString()
      : toDateAny(a.endAt)?.toLocaleString();

  return (
    <Link
      href={`/auctions/${a.id}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur-md hover:-translate-y-1 hover:shadow-[0_0_25px_-5px_rgba(56,189,248,0.3)] transition-all"
    >
      <div className="relative h-40 w-full overflow-hidden">
        {a.images?.[0] ? (
          <img
            src={a.images[0]}
            alt={a.title || "Auction"}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-gray-800 to-gray-700 grid place-items-center text-gray-400">
            No image
          </div>
        )}
        <div className="absolute left-2 top-2">
          <StatusBadge status={a.status} />
        </div>
      </div>
      <div className="p-4 space-y-2">
        <div className="line-clamp-1 font-medium text-gray-100">
          {a.title || "Auction"}
        </div>
        <div className="text-xs text-cyan-300/80">
          {a.status === "scheduled" && `Starts: ${date ?? "—"}`}
          {a.status === "live" && `Ends: ${date ?? "—"}`}
          {a.status === "ended" && `Ended: ${date ?? "—"}`}
        </div>
      </div>
    </Link>
  );
}

/* ---------------- Status Badge ---------------- */

function StatusBadge({ status }: { status: string }) {
  const cls =
    {
      live: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
      scheduled: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
      ended: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    }[status?.toLowerCase?.()] || "bg-gray-600/15 text-gray-300 ring-1 ring-gray-600/30";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}
