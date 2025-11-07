import { Timestamp, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase.client";

// Simple interest accrual to "now"
export async function accrueLoanNow(loanId: string) {
  const ref = doc(db, "loans", loanId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const loan = snap.data();

  if (loan.status !== "active") return loan;

  const now = new Date();
  const lastAccruedAt: Date = toDate(loan.lastAccruedAt) ?? toDate(loan.startDate) ?? now;
  const days = Math.max(0, daysBetween(lastAccruedAt, now));

  if (days > 0) {
    const apr = Number(loan.interestAPR ?? 0);
    const dailyRate = apr / 100 / 365;
    const outstanding = Number(loan.outstandingPrincipal ?? 0);
    const addInterest = round2(outstanding * dailyRate * days);
    const accrued = round2(Number(loan.accruedInterest ?? 0) + addInterest);

    await updateDoc(ref, {
      accruedInterest: accrued,
      lastAccruedAt: now,
      updatedAt: serverTimestamp(),
    });

    const updated = (await getDoc(ref)).data();
    return updated;
  }

  return loan;
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
}

export function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
