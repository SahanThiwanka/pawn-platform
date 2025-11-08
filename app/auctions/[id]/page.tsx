"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { auth, db, app as firebaseApp } from "../../lib/firebase.client";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "firebase/functions";

// ----- helpers -----
function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
}
function fmt(n?: number) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function hasEnded(a: any) {
  const end = toDateAny(a?.endAt)?.getTime() ?? 0;
  return Date.now() > end || a?.status === "ended" || a?.status === "settled";
}
function isLive(a: any) {
  const now = Date.now();
  const s = toDateAny(a?.startAt)?.getTime() ?? 0;
  const e = toDateAny(a?.endAt)?.getTime() ?? 0;
  return now >= s && now < e && a?.status === "live";
}
function minNextBid(startPrice: number, highest?: number) {
  const base = typeof highest === "number" && highest > 0 ? highest : startPrice;
  const tick = Math.max(1, Math.round(base * 0.01));
  return base + tick;
}

export default function AuctionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [auction, setAuction] = useState<any>(null);
  const [highest, setHighest] = useState<number | null>(null);
  const [bidCount, setBidCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ uid: string; verified: boolean } | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const functions = getFunctions(firebaseApp);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setMe(null);
        return;
      }
      await u.reload();
      setMe({ uid: u.uid, verified: u.emailVerified });
    });
    return () => unsub();
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

    const qBids = query(collection(db, "bids"), where("auctionId", "==", id));
    const unsubBids = onSnapshot(qBids, (s) => {
      setBidCount(s.size);
      if (s.empty) {
        setHighest(null);
        return;
      }
      let max = 0;
      s.forEach((d) => {
        const v = Number((d.data() as any).amount || 0);
        if (v > max) max = v;
      });
      setHighest(max || null);
    });

    return () => {
      unsubBids();
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

    try {
      setPlacing(true);
      const callable = httpsCallable(functions, "placeBid");
      await callable({ auctionId: auction.id, amount: amt });
      setMsg("✅ Bid placed!");
      setAmount(0);
    } catch (e: any) {
      const details = e?.message || "Failed to place bid.";
      setErr(details);
    } finally {
      setPlacing(false);
    }
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
        <div className="rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Auction not found.
        </div>
      </div>
    );

  const sAt = toDateAny(auction.startAt)?.toLocaleString();
  const eAt = toDateAny(auction.endAt)?.toLocaleString();

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* glow gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 max-w-5xl mx-auto p-6 space-y-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Image */}
          <div className="w-full md:w-1/2 overflow-hidden rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur-md">
            {auction.images?.[0] ? (
              <img
                src={auction.images[0]}
                alt={auction.title}
                className="h-80 w-full object-cover"
              />
            ) : (
              <div className="h-80 grid place-items-center text-gray-500">
                No image
              </div>
            )}
          </div>

          {/* Info + Bidding */}
          <div className="w-full md:w-1/2 space-y-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
              {auction.title || "Auction"}
            </h1>
            <div className="text-sm text-gray-400">
              Status:{" "}
              <span className="text-cyan-300 font-medium">{auction.status}</span>
            </div>
            <div className="text-sm text-gray-400">Starts: {sAt || "—"}</div>
            <div className="text-sm text-gray-400">Ends: {eAt || "—"}</div>

            <div className="rounded-xl border border-white/10 bg-gray-900/60 backdrop-blur-md p-4 space-y-1">
              <div className="text-xs text-gray-400">Start Price</div>
              <div className="text-lg font-semibold text-gray-100">
                {fmt(auction.startPrice)}
              </div>
              <div className="text-xs text-gray-400 mt-2">Highest Bid</div>
              <div className="text-lg font-semibold text-cyan-300">
                {highest !== null ? fmt(highest) : "—"}
              </div>
              <div className="text-xs text-gray-400 mt-2">Total Bids</div>
              <div className="text-lg font-semibold text-gray-200">{bidCount}</div>
            </div>

            {canBid ? (
              <form
                onSubmit={placeBid}
                className="rounded-xl border border-white/10 bg-gray-900/60 backdrop-blur-md p-4 space-y-3"
              >
                <div className="text-sm text-gray-300">
                  Minimum next bid:{" "}
                  <b className="text-cyan-300">{fmt(nextMin)}</b>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min={nextMin}
                    className="w-full rounded-lg border border-white/20 bg-gray-800/50 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                    placeholder={`≥ ${nextMin}`}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                  <button
                    disabled={placing}
                    className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {placing ? "Placing…" : "Place Bid"}
                  </button>
                </div>
                {err && (
                  <p className="rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 px-3 py-1 text-sm">
                    {err}
                  </p>
                )}
                {msg && (
                  <p className="rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1 text-sm">
                    {msg}
                  </p>
                )}
              </form>
            ) : (
              <div className="rounded-xl border border-white/10 bg-gray-900/60 backdrop-blur-md p-4 text-sm text-gray-400">
                {hasEnded(auction)
                  ? "Auction ended."
                  : "Auction is not live yet."}
              </div>
            )}
          </div>
        </div>

        {/* Results after end */}
        {hasEnded(auction) && (
          <div className="rounded-xl border border-white/10 bg-gray-900/60 backdrop-blur-md p-4 text-sm text-gray-200">
            {typeof auction.highestBid === "number" && auction.highestBid > 0 ? (
              <div className="space-y-1">
                <div>
                  Highest bid:{" "}
                  <b className="text-cyan-300">{fmt(auction.highestBid)}</b>
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
              </div>
            ) : (
              <div className="text-gray-400">No bids.</div>
            )}
          </div>
        )}

        {/* Extra Images */}
        {auction.images?.length > 1 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {auction.images.slice(1).map((src: string, i: number) => (
              <img
                key={i}
                src={src}
                className="h-28 w-full object-cover rounded-xl border border-white/10 hover:opacity-80 transition"
                alt=""
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
