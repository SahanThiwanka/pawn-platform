import { Suspense } from "react";
import NewCustomerClient from "./NewCustomerClient";

export const metadata = { title: "Add Customer" };

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <NewCustomerClient />
    </Suspense>
  );
}
