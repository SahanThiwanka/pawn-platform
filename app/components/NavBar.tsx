"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase.client";
import { doc, getDoc } from "firebase/firestore";

type Role = "user" | "shop_admin" | null;

const Brand = {
  name: "ePawning",
  gradient: "from-indigo-500 via-sky-500 to-cyan-400",
};

export default function NavBar() {
  const pathname = usePathname();

  const [authed, setAuthed] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setAuthed(false);
        setEmailVerified(null);
        setRole(null);
        return;
      }
      setAuthed(true);
      await u.reload();
      setEmailVerified(u.emailVerified);
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        setRole((snap.exists() && (snap.data() as any).role) || null);
      } catch {
        setRole(null);
      }
    });
    return () => unsub();
  }, []);

  const logout = async () => {
    await auth.signOut();
    window.location.href = "/login";
  };

  const publicLinks: { href: string; label: string }[] = [
    { href: "/", label: "Home" },
    { href: "/auctions", label: "Auctions" },
    { href: "/login", label: "Login" },
    { href: "/register/user", label: "Register User" },
    { href: "/register/shop", label: "Register Shop" },
  ];

  const verifyLinks: { href: string; label: string }[] = [
    { href: "/verify", label: "Verify Email" },
  ];

  const privateLinksByRole: Record<
    Exclude<Role, null>,
    { href: string; label: string }[]
  > = {
    user: [
      { href: "/user/dashboard", label: "Dashboard" },
      { href: "/user/loans", label: "Loans" },
      { href: "/user/shops", label: "My Shops" },
      { href: "/user/shops/requests", label: "Requests" },
      { href: "/auctions", label: "Auctions" },
      { href: "/user/collateral", label: "My Jewelry" },
    ],
    shop_admin: [
      { href: "/shop/dashboard", label: "Dashboard" },
      { href: "/shop/loans", label: "Loans" },
      { href: "/shop/customers", label: "Customers" },
      { href: "/shop/auctions", label: "Auctions" },
      { href: "/shop/loan-requests", label: "Loan Requests" },
      { href: "/shop/payments", label: "Payments" },
    ],
  };

  const linksToShow = authed
    ? emailVerified === false
      ? verifyLinks
      : role
      ? privateLinksByRole[role]
      : []
    : publicLinks;

  return (
    <nav className="sticky top-0 z-40 w-full">
      <div className={`h-1 w-full bg-gradient-to-r ${Brand.gradient}`} />
      <div className="border-b bg-gray-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="grid h-9 w-9 place-items-center rounded-xl bg-gray-800 shadow ring-1 ring-white/10"
            >
              <span className="text-lg text-white">⚡</span>
            </Link>
            <Link
              href="/"
              className="text-base font-semibold tracking-tight text-white md:text-lg"
            >
              {Brand.name}
            </Link>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <LanguageSelect />

            {linksToShow.map((l) => {
              const active =
                pathname === l.href ||
                (l.href !== "/" && pathname.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "border border-white/10 bg-gray-800 text-gray-200 hover:bg-gray-700"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}

            {authed && (
              <button
                onClick={logout}
                className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/30 hover:translate-y-[-1px] hover:shadow-lg"
              >
                Logout
              </button>
            )}
          </div>

          <button
            aria-label="Toggle menu"
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-gray-800 md:hidden"
            onClick={() => setOpen((s) => !s)}
          >
            <div className="space-y-[5px]">
              <span className="block h-[2px] w-5 bg-gray-200" />
              <span className="block h-[2px] w-5 bg-gray-200" />
              <span className="block h-[2px] w-5 bg-gray-200" />
            </div>
          </button>
        </div>

        {open && (
          <div className="border-t border-white/10 bg-gray-900/90 px-6 pb-4 pt-2 backdrop-blur md:hidden">
            <div className="mb-3">
              <LanguageSelect />
            </div>
            <div className="flex flex-col gap-2">
              {linksToShow.map((l) => {
                const active =
                  pathname === l.href ||
                  (l.href !== "/" && pathname.startsWith(l.href));
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      active
                        ? "bg-indigo-600 text-white"
                        : "border border-white/10 bg-gray-800 text-gray-200"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
              {authed && (
                <button
                  onClick={async () => {
                    await logout();
                    setOpen(false);
                  }}
                  className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium text-white"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function LanguageSelect() {
  return (
    <div className="group relative">
      <select className="appearance-none rounded-full border border-white/10 bg-gray-800 px-4 py-2 pr-8 text-sm text-gray-200 backdrop-blur hover:bg-gray-700">
        <option>English</option>
        <option>සිංහල</option>
        <option>தமிழ்</option>
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
        ▾
      </div>
    </div>
  );
}