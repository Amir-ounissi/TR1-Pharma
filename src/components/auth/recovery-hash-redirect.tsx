"use client";

import { useEffect } from "react";

export function RecoveryHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("type=recovery")) return;
    window.location.replace(`/reset-password${hash}`);
  }, []);

  return null;
}
