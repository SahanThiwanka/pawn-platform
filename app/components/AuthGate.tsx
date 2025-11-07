"use client";

import { ReactNode, useEffect, useState } from "react";
import { auth } from "../lib/firebase.client";
import { onAuthStateChanged, User } from "firebase/auth";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); }), []);
  if (!ready) return <div className="p-8 text-center">Loading...</div>;
  return <>{children}</>;
}
