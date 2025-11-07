import { Timestamp } from "firebase/firestore";

export function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
}

export function isLive(auction: any): boolean {
  const now = Date.now();
  const s = toDateAny(auction.startAt)?.getTime() ?? 0;
  const e = toDateAny(auction.endAt)?.getTime() ?? 0;
  return auction.status === "live" || (now >= s && now <= e);
}

export function hasEnded(auction: any): boolean {
  const now = Date.now();
  const e = toDateAny(auction.endAt)?.getTime() ?? 0;
  return auction.status === "ended" || now > e;
}

export function minNextBid(startPrice: number, highestBid?: number): number {
  const base = Math.max(startPrice || 0, highestBid || 0);
  const inc = base < 1000 ? 10 : base < 5000 ? 50 : 100;
  return base + inc;
}

export function fmt(n: number | undefined | null) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
