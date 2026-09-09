import { useEffect, useState } from "react";
import { Plus, Megaphone, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { todayIso } from "@/lib/utils";

export function NoticesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  function load() { api.notices.list().then(setItems); }
  useEffect(load, []);
  async function remove(id: number) { await api.notices.delete(id); load(); }

  return (
    <div>
      <PageHeader title="Notices" description="Publish announcements to teachers, students, parents or specific classes." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Notice</Button>} />
      {items.length === 0 ? (
        <EmptyState icon={Megaphone} title="No notices published yet" actionLabel="New Notice" onAction={() => setOpen(true)} />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{n.title}</p>
                    <Badge variant="outline">{n.audience}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Published {n.publish_date}{n.expiry_date ? ` · Expires ${n.expiry_date}` : ""}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(n.id)}><Trash2 className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <NoticeFormDialog open={open} onOpenChange={setOpen} onSaved={load} />
    </div>
  );
}

function NoticeFormDialog({ open, onOpenChange, onSaved }: any) {
  const [form, setForm] = useState<any>({ title: "", description: "", audience: "all", publishDate: todayIso(), expiryDate: "" });
  const [saving, setSaving] = useState(false);
  function f(k: string, v: any) { setForm((s: any) => ({ ...s, [k]: v })); }
  async function submit() {
    if (!form.title) { toast.error("Title is required."); return; }
    setSaving(true);
    try { await api.notices.create(form); toast.success("Notice published."); onOpenChange(false); onSaved(); }
    catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Notice</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label required>Title</Label><Input value={form.title} onChange={(e) => f("title", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => f("description", e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select value={form.audience} onValueChange={(v) => f("audience", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["all", "teachers", "students", "parents", "staff"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label required>Publish Date</Label><Input type="date" value={form.publishDate} onChange={(e) => f("publishDate", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Expiry Date</Label><Input type="date" value={form.expiryDate} onChange={(e) => f("expiryDate", e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button loading={saving} onClick={submit}>Publish</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
