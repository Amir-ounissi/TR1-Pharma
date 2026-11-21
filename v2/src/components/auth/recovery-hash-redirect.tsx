"use client";

import { useEffect } from "react";

export function RecoveryHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      window.location.replace(`/reset-password${hash}`);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.location.replace(`/auth/recovery?code=${encodeURIComponent(code)}`);
    }
  }, []);

  return null;
}
