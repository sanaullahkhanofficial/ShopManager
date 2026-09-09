import { useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";

export function Login() {
  const login = useAuthStore((s) => s.login);
  const school = useSettingsStore((s) => s.school);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold">{school?.name || "EduManage"}</h1>
          <p className="text-sm text-muted-foreground">Sign in to your school management account</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label required>Username</Label>
            <Input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
          </div>
          <div className="space-y-1.5">
            <Label required>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
