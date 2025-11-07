import { Suspense } from "react";
import NewAuctionClient from "./NewAuctionClient";

export const metadata = {
  title: "Create Auction",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <NewAuctionClient />
    </Suspense>
  );
}
