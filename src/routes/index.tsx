import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Gavel, LockKeyhole, MapPin, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  adminLogin,
  adminLogout,
  adminStatus,
  createEvent,
  deleteEvent,
  listEvents,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Admin Portal — Event Judging & Score Management" },
      {
        name: "description",
        content:
          "Create events, add judges and participants, build dynamic mark sheets and publish live rankings for any competition.",
      },
      { property: "og:title", content: "Admin Portal — Event Judging & Score Management" },
      {
        property: "og:description",
        content: "Run live competitions: dynamic mark sheets, multi-judge scoring, instant rankings and printable results.",
      },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const status = useQuery({ queryKey: ["admin-status"], queryFn: () => adminStatus() });

  if (status.isLoading) {
    return <Shell><p className="text-muted-foreground">Loading…</p></Shell>;
  }

  if (!status.data?.authed) {
    return <LoginScreen configured={status.data?.configured ?? false} onDone={() => status.refetch()} />;
  }

  return <EventsScreen />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </main>
  );
}

function LoginScreen({ configured, onDone }: { configured: boolean; onDone: () => void }) {
  const login = useServerFn(adminLogin);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await login({ data: { password } });
      if (!res.ok) setError(res.error);
      else onDone();
    } catch {
      setError("Sign in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Gavel className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold">Event Judging Control</h1>
          <p className="mt-1 text-sm text-muted-foreground">Admin Portal</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="password">Admin password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {!configured && (
            <p className="text-xs text-destructive">Admin password is not configured yet.</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !password}>
            <LockKeyhole className="size-4" /> Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Judging on a tablet?{" "}
          <Link to="/judge" className="font-medium text-primary underline-offset-4 hover:underline">
            Open the Judge Portal
          </Link>
        </p>
      </div>
    </main>
  );
}

function EventsScreen() {
  const qc = useQueryClient();
  const router = useRouter();
  const events = useQuery({ queryKey: ["events"], queryFn: () => listEvents() });
  const create = useServerFn(createEvent);
  const remove = useServerFn(deleteEvent);
  const logout = useServerFn(adminLogout);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", event_date: "", venue: "", description: "" });

  const createMut = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: (res) => {
      setOpen(false);
      setForm({ name: "", event_date: "", venue: "", description: "" });
      qc.invalidateQueries({ queryKey: ["events"] });
      router.navigate({ to: "/event/$eventId", params: { eventId: res.id } });
    },
    onError: () => toast.error("Could not create the event."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Event deleted permanently.");
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return (
    <Shell>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Events</h1>
          <p className="text-sm text-muted-foreground">Every event keeps its own judges, participants and scores.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={async () => { await logout({ data: undefined }); qc.clear(); router.invalidate(); }}>
            Sign out
          </Button>
          <Button onClick={() => setOpen((v) => !v)}>
            <Plus className="size-4" /> New event
          </Button>
        </div>
      </header>

      {open && (
        <form
          className="mb-8 grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) return;
            createMut.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Event name</Label>
            <Input id="name" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Project Expo 2026" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue">Venue</Label>
            <Input id="venue" value={form.venue} maxLength={160} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Main Auditorium" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={form.description} maxLength={1000} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={createMut.isPending || !form.name.trim()}>
              Create event
            </Button>
          </div>
        </form>
      )}

      {events.isLoading && <p className="text-muted-foreground">Loading events…</p>}

      {events.data && events.data.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-medium">No events yet</p>
          <p className="text-sm text-muted-foreground">Create your first event to start judging.</p>
        </div>
      )}

      <div className="grid gap-3">
        {(events.data ?? []).map((ev) => (
          <div key={ev.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <Link to="/event/$eventId" params={{ eventId: ev.id }} className="truncate text-lg font-semibold hover:text-primary">
                  {ev.name}
                </Link>
                <StatusBadge status={ev.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {ev.event_date && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3.5" /> {ev.event_date}
                  </span>
                )}
                {ev.venue && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" /> {ev.venue}
                  </span>
                )}
                <span className="font-mono text-xs">Code {ev.join_code}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link to="/event/$eventId" params={{ eventId: ev.id }}>Open</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Delete "${ev.name}" permanently? All judges, participants, scores and results will be erased.`)) {
                    deleteMut.mutate(ev.id);
                  }
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    setup: "bg-muted text-muted-foreground",
    live: "bg-success/15 text-success",
    completed: "bg-primary/15 text-primary",
  };
  return <Badge className={`border-0 capitalize ${map[status] ?? map["setup"]}`}>{status}</Badge>;
}
