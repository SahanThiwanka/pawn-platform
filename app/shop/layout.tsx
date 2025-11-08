"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { auth, db } from "../lib/firebase.client";
import { doc, getDoc, collection, query, where, limit, getDocs } from "firebase/firestore";

type Props = { children: ReactNode };

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase() || "S";
}

export default function ShopSectionLayout({ children }: Props) {
  const [shopLabel, setShopLabel] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      try {
        if (!u) {
          setShopLabel(null);
          setReady(true);
          return;
        }

        // Load current user doc
        const meSnap = await getDoc(doc(db, "users", u.uid));
        const me = meSnap.exists() ? (meSnap.data() as any) : null;

        // Prefer explicit shopName on the user doc
        let name = me?.shopName || me?.displayName || null;

        // If we only have a shopId, try resolving it:
        const sid = me?.shopId as string | undefined;

        if (!name && sid) {
          // Try to resolve shop name from shops/<id>
          try {
            const sSnap = await getDoc(doc(db, "shops", sid));
            if (sSnap.exists()) {
              const s = sSnap.data() as any;
              name = s?.name || s?.shopName || null;
            }
          } catch {
            /* ignore */
          }

          // Fallback: find user with that shopId
          if (!name) {
            try {
              const res = await getDocs(
                query(collection(db, "users"), where("shopId", "==", sid), limit(1))
              );
              const udata = res.docs[0]?.data() as any;
              if (udata) name = udata.shopName || udata.displayName || null;
            } catch {
              /* ignore */
            }
          }

          if (!name) name = sid; // fallback
        }

        // Last resort: user display/email
        if (!name) {
          name = u.displayName || u.email?.split("@")[0] || u.email || u.uid;
        }

        setShopLabel(String(name));
      } catch {
        setShopLabel("Shop");
      } finally {
        setReady(true);
      }
    });
    return () => unsub();
  }, []);

  const initials = useMemo(() => getInitials(shopLabel ?? "Shop"), [shopLabel]);

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* Glow background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-20 blur-3xl" />

      {/* Top bar */}
      <div className="relative z-10 border-b border-white/10 bg-gray-900/60 backdrop-blur-md sticky top-0">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-gray-800/80 text-xs font-semibold">
            {ready ? initials : "…"}
          </div>
          <div className="text-sm text-gray-300">
            {ready ? (
              <>
                Welcome,&nbsp;
                <span className="font-semibold text-white">
                  {shopLabel ?? "Shop"}
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
