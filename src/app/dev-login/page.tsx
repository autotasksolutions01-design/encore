"use client";

import { useEffect, useState } from "react";

// Login directo sin CSRF — para probar detrás de túneles
// Uso: /dev-login?email=luciana@encore.local

export default function DevLoginPage() {
  const [email, setEmail] = useState("luciana@encore.local");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextEmail = params.get("email") || "luciana@encore.local";
    setEmail(nextEmail);
    window.location.href = `/api/dev-login?email=${encodeURIComponent(nextEmail)}`;
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-slate-400">Iniciando sesión como {email}...</p>
    </div>
  );
}
