"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { auth, db } from "../../lib/firebase.client";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";
import { fmt, isLive, hasEnded, minNextBid, toDateAny } from "../../lib/auction";

export default function AuctionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [auction, setAuction] = useState<any>(null);
  const [highest, setHighest] = useState<number | null>(null);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ uid: string; verified: boolean } | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return setMe(null);
      await u.reload();
      setMe({ uid: u.uid, verified: u.emailVerified });
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "auctions", id));
      if (!snap.exists()) {
        setLoading(false);
        return;
      }
      setAuction({ id, ...(snap.data() as any) });
      setLoading(false);
    })();

    const qTop = query(
      collection(db, "bids"),
      where("auctionId", "==", id),
      orderBy("amount", "desc"),
      limit(1)
    );
    const qAll = query(collection(db, "bids"), where("auctionId", "==", id));
    const unsubTop = onSnapshot(qTop, (s) => {
      if (s.empty) return setHighest(null);
      setHighest(Number(s.docs[0].data().amount || 0));
    });
    const unsubAll = onSnapshot(qAll, (s) => setCount(s.size));
    return () => {
      unsubTop();
      unsubAll();
    };
  }, [id]);

  const canBid = useMemo(() => {
    if (!auction) return false;
    if (!me || !me.verified) return false;
    if (hasEnded(auction)) return false;
    return isLive(auction) || auction.status === "live";
  }, [auction, me]);

  const nextMin = useMemo(() => {
    if (!auction) return 0;
    return minNextBid(Number(auction.startPrice || 0), highest ?? undefined);
  }, [auction, highest]);

  const placeBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!auction) return;
    if (!me) return setErr("Please log in to bid.");
    if (!me.verified) return setErr("Verify your email to bid.");
    if (!canBid) return setErr("Auction is not live.");

    const amt = Number(amount || 0);
    if (isNaN(amt) || amt < nextMin) {
      return setErr(`Your bid must be at least ${fmt(nextMin)}.`);
    }

    setErr("Wire this handler to callable placeBid() as earlier steps showed.");
  };

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading auction…
        </div>
      </div>
    );

  if (!auction)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        Not found
      </div>
    );

  const sAt = toDateAny(auction.startAt)?.toLocaleString();
  const eAt = toDateAny(auction.endAt)?.toLocaleString();

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-5xl p-6 space-y-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 rounded-2xl border border-white/10 bg-gray-900/70 overflow-hidden backdrop-blur-md">
            {auction.images?.[0] ? (
              <img
                src={auction.images[0]}
                className="h-96 w-full object-cover"
                alt={auction.title}
              />
            ) : (
              <div className="h-96 bg-gradient-to-br from-gray-800 to-gray-700 grid place-items-center text-gray-400">
                No image
              </div>
            )}
          </div>

          <div className="flex-1 space-y-5">
            <h1 className="text-3xl font-bold">{auction.title || "Auction"}</h1>

            <div className="flex flex-wrap gap-2">
              <StatusBadge status={auction.status} />
            </div>

            <div className="text-sm text-gray-400 space-y-1">
              <div>Starts: {sAt || "—"}</div>
              <div>Ends: {eAt || "—"}</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-gray-900/60 p-4 space-y-3 backdrop-blur-sm">
              <div>
                <div className="text-xs text-gray-400">Start Price</div>
                <div className="text-lg font-semibold">
                  {fmt(auction.startPrice)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Highest Bid</div>
                <div className="text-lg font-semibold">
                  {highest !== null ? fmt(highest) : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Bids</div>
                <div className="text-lg font-semibold">{count}</div>
              </div>
            </div>

            {canBid ? (
              <form
                onSubmit={placeBid}
                className="rounded-xl border border-white/10 bg-gray-900/60 p-4 space-y-3 backdrop-blur-sm"
              >
                <div className="text-sm text-gray-400">
                  Minimum next bid: <b>{fmt(nextMin)}</b>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min={nextMin}
                    className="w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={`≥ ${nextMin}`}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                  <button className="rounded-lg bg-indigo-600 text-white px-4 py-2 hover:opacity-90 transition">
                    Place Bid
                  </button>
                </div>
                {err && <p className="text-sm text-red-400">{err}</p>}
                {msg && <p className="text-sm text-emerald-400">{msg}</p>}
              </form>
            ) : (
              <div className="rounded-xl border border-white/10 bg-gray-900/60 p-4 text-sm text-gray-400 backdrop-blur-sm">
                {hasEnded(auction)
                  ? "Auction ended."
                  : "Auction is not live yet."}
              </div>
            )}
          </div>
        </div>

        {hasEnded(auction) && (
          <div className="rounded-xl border border-white/10 bg-gray-900/60 p-4 text-sm space-y-2 backdrop-blur-sm">
            {typeof auction.highestBid === "number" && auction.highestBid > 0 ? (
              <>
                <div>
                  Highest bid: <b>{fmt(auction.highestBid)}</b>
                </div>
                {auction.winnerUserUid ? (
                  <div>
                    Winner:{" "}
                    <code className="text-xs text-gray-400">
                      {auction.winnerUserUid}
                    </code>
                  </div>
                ) : (
                  <div className="text-gray-400">
                    Reserve not met — no winner.
                  </div>
                )}
              </>
            ) : (
              <div>No bids.</div>
            )}
          </div>
        )}

        {auction.images?.length > 1 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {auction.images.slice(1).map((src: string, i: number) => (
              <img
                key={i}
                src={src}
                className="h-32 w-full object-cover rounded-xl border border-white/10"
                alt=""
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------- Status badge ---------- */
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
