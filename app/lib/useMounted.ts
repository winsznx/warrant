"use client";

import { useEffect, useState } from "react";

/**
 * Returns true only after the component has mounted on the client. Used to gate
 * wallet/connection-dependent UI so server and first client render agree
 * (avoids hydration mismatches).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
