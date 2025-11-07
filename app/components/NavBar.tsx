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
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setAuthed(false);
        setRole(null);
        return;
      }
      setAuthed(true);
      // get role from Firestore
      const snap = await getDoc(doc(db, "users", u.uid));
      const r = (snap.exists() && snap.data().role) || null;
      setRole(r);
    });
    return () => unsub();
  }, []);

  const logout = async () => {
    await auth.signOut();
    window.location.href = "/login";
  };

  // links when not logged in
  const publicLinks = [
    { href: "/", label: "Home" },
    { href: "/login", label: "Login" },
    { href: "/register/user", label: "Register User" },
    { href: "/register/shop", label: "Register Shop" },
  ];

  // links by role
  const privateLinksByRole: Record<Exclude<Role, null>, { href: string; label: string }[]> = {
    user: [
      { href: "/user/dashboard", label: "Dashboard" },
      // add more: { href: "/user/profile", label: "Profile" }
    ],
    shop_admin: [
      { href: "/shop/dashboard", label: "Dashboard" },
      // add more: { href: "/shop/items", label: "Items" }
    ],
  };

  // show links depending on login & role
  const linksToShow = authed
    ? role
      ? privateLinksByRole[role]
      : [] // no role yet — maybe during first login
    : publicLinks;

  return (
    <nav className="w-full border-b bg-white/80 backdrop-blur">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold">
          MultiPawn
        </Link>

        <div className="flex items-center gap-4 text-sm font-medium">
          {linksToShow.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-2 py-1 rounded ${
                pathname === l.href ? "text-blue-600" : "hover:text-blue-600"
              }`}
            >
              {l.label}
            </Link>
          ))}
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
