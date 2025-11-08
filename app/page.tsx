"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "./lib/firebase.client";
import { doc, getDoc } from "firebase/firestore";

// --- Simple brand tokens (keep in TSX for single-file drop-in) ---
const Brand = {
  name: "ePawning",
  gradient: "from-indigo-500 via-sky-500 to-cyan-400",
  primary: "bg-indigo-600",
};

type Role = "user" | "shop_admin" | null;

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<Role>(null);
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setAuthed(false);
        setRole(null);
        setVerified(null);
        setLoading(false);
        return;
      }
      setAuthed(true);
      await u.reload();
      setVerified(u.emailVerified);
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        setRole((snap.exists() && (snap.data() as any).role) || null);
      } catch {
        setRole(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      {/* Soft radial background */}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${Brand.gradient} opacity-20`} />
      <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-white/25 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-white/25 blur-3xl" />

      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <LogoMark />
          <span className="text-lg font-semibold tracking-tight">{Brand.name}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
         
          {!authed ? (
            <Link href="/login" className="rounded-full border border-white/60 bg-white/60 px-4 py-2 backdrop-blur hover:bg-white">
              Login
            </Link>
          ) : null}
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 pb-16 pt-4 md:grid-cols-2 md:pt-6">
        <div className="order-2 space-y-6 md:order-1">
          <h1 className="text-3xl font-bold leading-tight md:text-5xl">
            Simple & instant pawn loans.
            <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-black/80 to-black/60"> Bid on the best deals.</span>
          </h1>
          <p className="max-w-prose text-base text-black/70 md:text-lg">
            Create an account in minutes, verify your mobile, and start pledging jewelry or bidding in live auctions with transparent increments.
          </p>
          <PrimaryCTA authed={authed} verified={verified} role={role} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Feature title="Secure Sign‑in" desc="Email + Google, verification, role‑based access." />
            <Feature title="Live Auctions" desc="Auto timers, realtime bids, fair steps." />
            <Feature title="Loan Workflow" desc="Pledge jewelry, shop terms, settlement." />
          </div>
        </div>


      </main>

      {/* How it works section */}
      <section className="relative z-10 mx-auto mb-20 w-full max-w-6xl px-6">
        <div className="rounded-3xl border border-white/40 bg-white/70 p-6 backdrop-blur-md md:p-8">
          <h2 className="text-xl font-semibold md:text-2xl">How it works</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-black/80">
            <li>Register as a user or a pawn shop.</li>
            <li>Verify mobile and complete profile/KYC.</li>
            <li>Users request loans using jewelry as collateral.</li>
            <li>Shops list eligible collateral in live auctions.</li>
            <li>Auctions end automatically and winners are recorded for settlement.</li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-2">
            <OutlineLink href="/register/user">Register User</OutlineLink>
            <OutlineLink href="/auctions">Explore Auctions</OutlineLink>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-8 text-xs text-black/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} {Brand.name}. All rights reserved.</span>
          <nav className="flex gap-4">
            <Link className="hover:underline" href="#">Privacy</Link>
            <Link className="hover:underline" href="#">Terms</Link>
            <Link className="hover:underline" href="#">Help</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// --- Components ---
function PrimaryCTA({ authed, verified, role }: { authed: boolean; verified: boolean | null; role: Role }) {
  if (!authed) {
    return (
      <div className="flex flex-wrap gap-3">
        <PrimaryButton href="/register/user">Create Account</PrimaryButton>
        <OutlineLink href="/login">Login</OutlineLink>
        <OutlineLink href="/auctions">Browse Auctions</OutlineLink>
      </div>
    );
  }

  if (verified === false) {
    return (
      <div className="flex flex-wrap gap-3">
        <PrimaryButton href="/verify">Verify Email</PrimaryButton>
        <OutlineLink href="/auctions">Browse Auctions</OutlineLink>
      </div>
    );
  }

  if (role === "shop_admin") {
    return (
      <div className="flex flex-wrap gap-3">
        <PrimaryButton href="/shop/dashboard">Shop Dashboard</PrimaryButton>
        <OutlineLink href="/shop/auctions">Manage Auctions</OutlineLink>
        <OutlineLink href="/shop/sales">Sales</OutlineLink>
        <OutlineLink href="/auctions">Public Auctions</OutlineLink>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <PrimaryButton href="/user/dashboard">My Dashboard</PrimaryButton>
      <OutlineLink href="/auctions">Browse Auctions</OutlineLink>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-4 backdrop-blur-md">
      <div className="text-sm font-semibold md:text-base">{title}</div>
      <p className="mt-1 text-xs text-black/70 md:text-sm">{desc}</p>
    </div>
  );
}

function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:translate-y-[-1px] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
    >
      {children}
    </Link>
  );
}

function OutlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-black/10 bg-white/70 px-5 py-2.5 text-sm font-medium text-black/80 backdrop-blur transition hover:bg-white"
    >
      {children}
    </Link>
  );
}

function LabeledInput({ label, placeholder }: { label: string; placeholder?: string }) {
  return (
    <label className="mb-2 block text-xs">
      <span className="mb-1 block text-black/70">{label}</span>
      <input placeholder={placeholder} className="w-full rounded-xl border border-black/20 bg-white/70 px-3 py-2 outline-none ring-indigo-200 focus:ring" />
    </label>
  );
}

function LogoMark() {
  return (
    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white shadow ring-1 ring-black/10">
      <span className="text-xl">⚡</span>
    </div>
  );
}
