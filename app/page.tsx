import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-dvh flex flex-col">
      {/* ---------- HERO SECTION ---------- */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center bg-gradient-to-b from-gray-50 to-white">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          Manage Pawn Shops & Auctions Seamlessly
        </h1>
        <p className="text-gray-600 max-w-xl mb-8">
          MultiPawn connects customers and pawn shops on one secure platform.
          Manage loans, auctions, and reminders — all in one place.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/register"
            className="rounded-xl bg-black text-white px-6 py-3 hover:bg-gray-800"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-gray-400 px-6 py-3 hover:bg-gray-100"
          >
            Login
          </Link>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="border-t text-center text-sm text-gray-500 py-4">
        © {new Date().getFullYear()} MultiPawn Platform. All rights reserved.
      </footer>
    </main>
  );
}
