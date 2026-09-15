import React, { useState } from "react";
import { Wheat } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import type { AuthUser } from "../types";

export function Login({ onLogin }: { onLogin: (u: AuthUser) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    setError("");
    try {
      const user = await api.login(username, password) as AuthUser;
      onLogin(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-navy-900 via-brand-green-800 to-brand-green-600 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-wheat-400 text-brand-navy-900">
            <Wheat size={28} />
          </div>
          <h1 className="text-lg font-bold leading-tight text-brand-navy-900">Haji Abdul Manan &amp; Abdul Hanan</h1>
          <p className="text-sm font-medium text-brand-green-700">Atta Dealer Pishin</p>
          <p className="mt-1 text-xs text-stone-400">Retail &amp; Wholesale POS · Local Database</p>
        </div>
        <div className="space-y-3">
          <Field label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Field
            label="Password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
          />
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button variant="primary" className="w-full" onClick={go} disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-xs text-stone-400">First login: admin / admin123 — change it under Settings.</p>
        </div>
      </div>
    </div>
  );
}
