import { Suspense } from "react";
import NewAuctionClient from "./NewAuctionClient";

export const metadata = {
  title: "Create Auction",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
          <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
            Loading form…
          </div>
        </div>
      }
    >
      <NewAuctionClient />
    </Suspense>
  );
}
