"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase.client";
import Link from "next/link";
import { toDateAny } from "../lib/auction";

type A = {
  id: string;
  title: string;
  images?: string[];
  status: string;
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

      setLive(lS.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setSched(sS.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setEnded(eS.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading auctions…</div>;

  const Section = ({ title, items }: { title: string; items: A[] }) => (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No items.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(a => (
            <Link
              key={a.id}
              href={`/auctions/${a.id}`}
              className="border rounded-xl overflow-hidden hover:shadow-sm"
            >
              {a.images?.[0] ? (
                <img
                  src={a.images[0]}
                  alt={a.title}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="h-40 w-full bg-gray-100" />
              )}
              <div className="p-3">
                <div className="font-medium">{a.title || "Auction"}</div>
                <div className="text-xs text-gray-600">
                  {a.status === "scheduled" &&
                    `Starts: ${toDateAny(a.startAt)?.toLocaleString()}`}
                  {a.status === "live" &&
                    `Ends: ${toDateAny(a.endAt)?.toLocaleString()}`}
                  {a.status === "ended" &&
                    `Ended: ${toDateAny(a.endAt)?.toLocaleString()}`}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Auctions</h1>
      <Section title="Live" items={live} />
      <Section title="Scheduled" items={sched} />
      <Section title="Recently Ended" items={ended} />
    </main>
  );
}
