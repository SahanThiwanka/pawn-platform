"use client";

import { Suspense } from "react";
import NewLoanRequestClient from "./NewLoanRequestClient";

export default function Page(){
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <NewLoanRequestClient/>
    </Suspense>
  );
}
