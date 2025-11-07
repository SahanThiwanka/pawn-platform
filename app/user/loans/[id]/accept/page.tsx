"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../../lib/firebase.client";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

export default function AcceptLoanOfferPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loan, setLoan] = useState<any>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      const snap = await getDoc(doc(db, "loans", id));
      setLoan(snap.data());
    });
    return () => unsub();
  }, [id, router]);

  const accept = async () => {
    const start = new Date();
    const due = new Date(start.getTime() + (loan.termDays * 24 * 60 * 60 * 1000));
    await updateDoc(doc(db, "loans", id), {
      status: "active",
      startDate: start,
      dueDate: due,
      lastAccruedAt: start,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "collaterals", loan.collateralId), {
      status: "loan_active",
      updatedAt: serverTimestamp(),
    });
    router.replace("/user/loans");
  };

  if (!loan) return <div className="p-8 text-center">Loading...</div>;
  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Loan Offer</h1>
      <ul className="text-sm text-gray-700 space-y-1">
        <li>Principal: {loan.principal}</li>
        <li>APR: {loan.interestAPR}%</li>
        <li>Term: {loan.termDays} days</li>
        <li>LTV: {loan.ltvPercent}%</li>
        <li>Max top-up cap: {loan.maxPrincipalAllowed}</li>
      </ul>
      <button onClick={accept} className="rounded-lg bg-black text-white px-4 py-2">Accept & Activate</button>
    </main>
  );
}
