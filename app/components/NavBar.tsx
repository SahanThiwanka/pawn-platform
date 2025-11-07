"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase.client";
import { doc, getDoc } from "firebase/firestore";

type Role = "user" | "shop_admin" | null;

export default function NavBar() {
  const pathname = usePathname();

  const [authed, setAuthed] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setAuthed(false);
        setEmailVerified(null);
        setRole(null);
        return;
      }

      setAuthed(true);
      await u.reload(); // make sure emailVerified is up to date
      setEmailVerified(u.emailVerified);

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const r = (snap.exists() && (snap.data() as any).role) || null;
        setRole(r);
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

  // public links (not logged in)
  const publicLinks: { href: string; label: string }[] = [
    { href: "/", label: "Home" },
    { href: "/auctions", label: "Auctions" }, // public browse
    { href: "/login", label: "Login" },
    { href: "/register/user", label: "Register User" },
    { href: "/register/shop", label: "Register Shop" },
  ];

  // links while logged in but NOT email-verified
  const verifyLinks: { href: string; label: string }[] = [
    { href: "/verify", label: "Verify Email" },
  ];

  // role-based links (ONLY one Dashboard item shown)
  const privateLinksByRole: Record<Exclude<Role, null>, { href: string; label: string }[]> = {
    user: [
      { href: "/user/dashboard", label: "Dashboard" },
      { href: "/user/loans", label: "Loans" },
      { href: "/user/shops", label: "My Shops" },
      { href: "/user/shops/requests", label: "Requests" },
      { href: "/auctions", label: "Auctions" }, // public page still accessible
    ],
    shop_admin: [
      { href: "/shop/dashboard", label: "Dashboard" },
      { href: "/shop/loans", label: "Loans" },
      { href: "/shop/customers", label: "Customers" },
      { href: "/shop/auctions", label: "Auctions" },
    ],
  };

  // decide which links to show
  const linksToShow =
    authed
      ? emailVerified === false
        ? verifyLinks
        : role
          ? privateLinksByRole[role]
          : [] // logged in but role not set yet
      : publicLinks;

  return (
    <nav className="w-full border-b bg-white/80 backdrop-blur">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold">
          MultiPawn
        </Link>

        <div className="flex items-center gap-4 text-sm font-medium">
          {linksToShow.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-2 py-1 rounded ${
                  active ? "text-blue-600" : "hover:text-blue-600"
                }`}
              >
                {l.label}
              </Link>
            );
          })}

          {authed && (
            <button
              onClick={logout}
              className="rounded-lg border px-3 py-1.5 hover:bg-gray-100"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
