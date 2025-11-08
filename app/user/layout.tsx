"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { auth, db } from "../lib/firebase.client";
import { doc, getDoc } from "firebase/firestore";

type Props = { children: ReactNode };

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase() || "U";
}

export default function UserSectionLayout({ children }: Props) {
  const [display, setDisplay] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      try {
        if (!u) {
          setDisplay(null);
          setReady(true);
          return;
        }
        const snap = await getDoc(doc(db, "users", u.uid));
        const data = snap.exists() ? (snap.data() as any) : {};
        const nameFromDb = data?.displayName || data?.fullName;

        const name =
          nameFromDb ||
          u.displayName ||
          u.email?.split("@")[0] ||
          u.email ||
          u.uid;

        setDisplay(String(name));
      } catch {
        const u2 = auth.currentUser;
        setDisplay(u2?.email || u2?.uid || "User");
      } finally {
        setReady(true);
      }
    });
    return () => unsub();
  }, []);

  const initials = useMemo(() => getInitials(display ?? "User"), [display]);

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* background glow */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-20 blur-3xl" />

      {/* Welcome bar */}
      <div className="relative z-10 border-b border-white/10 bg-gray-900/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {/* Avatar */}
          <div className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-gray-800/80 text-xs font-semibold">
            {ready ? initials : "…"}
          </div>
          <div className="text-sm text-gray-300">
            {ready ? (
              <>
                Welcome,&nbsp;
                <span className="font-semibold text-white">
                  {display ?? "Guest"}
                </span>
              </>
            ) : (
              <span className="inline-block animate-pulse rounded-md bg-white/10 px-3 py-1">
                Loading…
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="relative z-10">
        <div className="mx-auto max-w-6xl px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
