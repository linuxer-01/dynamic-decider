import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  Lock,
  MapPin,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addCriterion,
  addJudge,
  addParticipant,
  deleteEvent,
  getEventSnapshot,
  removeCriterion,
  removeJudge,
  removeParticipant,
  renameJudge,
  setJudgeDevice,
  updateCriterion,
  updateEvent,
  updateParticipant,
} from "@/lib/admin.functions";
import {
  hasSubmission,
  judgeTotalFor,
  maxTotal,
  progressStats,
  rankParticipants,
  type EventSnapshot,
} from "@/lib/scoring";

export const Route = createFileRoute("/event/$eventId")({
  head: () => ({
    meta: [
      { title: "Event Dashboard — Judging Control Center" },
      {
        name: "description",
        content:
          "Manage judges, participants, mark sheet criteria, live scoring progress and final rankings for this event.",
      },
      { property: "og:title", content: "Event Dashboard — Judging Control Center" },
      {
        property: "og:description",
        content: "Judges, participants, dynamic mark sheet, live progress and final rankings in one place.",
      },
    ],
  }),
  component: EventDashboard,
});

function useSnapshot(eventId: string) {
  return useQuery<EventSnapshot>({
    queryKey: ["event", eventId],
    queryFn: () => getEventSnapshot({ data: { id: eventId } }),
    refetchInterval: 5000,
  });
}

function EventDashboard() {
  const { eventId } = Route.useParams();
  const snap = useSnapshot(eventId);

  if (snap.isLoading) {
    return <Shell><p className="text-muted-foreground">Loading event…</p></Shell>;
  }
  if (snap.isError || !snap.data) {
    return (
      <Shell>
        <p className="text-destructive">This event could not be loaded. You may need to sign in again.</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/">Back to events</Link></Button>
      </Shell>
    );
  }

  const data = snap.data;
  const locked = data.event.status === "completed";

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All events
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{data.event.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {data.event.event_date && (
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{data.event.event_date}</span>
            )}
            {data.event.venue && (
              <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{data.event.venue}</span>
            )}
            <Badge variant={locked ? "secondary" : "default"}>{data.event.status}</Badge>
          </div>
        </div>
        <JoinCode code={data.event.join_code} />
      </div>

      <Tabs defaultValue="judges">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="judges">Judges</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="marksheet">Mark Sheet</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="details"><DetailsTab data={data} /></TabsContent>
        <TabsContent value="judges"><JudgesTab data={data} /></TabsContent>
        <TabsContent value="participants"><ParticipantsTab data={data} /></TabsContent>
        <TabsContent value="marksheet"><CriteriaTab data={data} /></TabsContent>
        <TabsContent value="progress"><ProgressTab data={data} /></TabsContent>
        <TabsContent value="results"><ResultsTab data={data} /></TabsContent>
      </Tabs>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </main>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card p-5 ${className}`}>{children}</div>;
}

function JoinCode({ code }: { code: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-center">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Judge join code</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="score-num text-2xl font-bold tracking-[0.3em] text-primary">{code}</span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            navigator.clipboard?.writeText(code);
            toast.success("Join code copied");
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function useRefresh(eventId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["event", eventId] });
}

/* ---------------- Details ---------------- */

function DetailsTab({ data }: { data: EventSnapshot }) {
  const refresh = useRefresh(data.event.id);
  const router = useRouter();
  const save = useServerFn(updateEvent);
  const del = useServerFn(deleteEvent);
  const [form, setForm] = useState({
    name: data.event.name,
    event_date: data.event.event_date ?? "",
    venue: data.event.venue ?? "",
    description: data.event.description ?? "",
  });
  const [confirmName, setConfirmName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const locked = data.event.status === "completed";

  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) => save({ data: { id: data.event.id, ...patch } }),
    onSuccess: () => { refresh(); toast.success("Event updated"); },
    onError: () => toast.error("Could not update the event"),
  });

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Event details</h2>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Date</Label><Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
            <div><Label>Venue</Label><Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></div>
          </div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <Button
            onClick={() =>
              update.mutate({
                name: form.name.trim(),
                event_date: form.event_date || null,
                venue: form.venue || null,
                description: form.description || null,
              })
            }
            disabled={update.isPending || !form.name.trim()}
          >
            Save changes
          </Button>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Event status</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {locked
              ? "This event is completed. Judges can no longer change scores and results are final."
              : "Set the event live while judging is in progress. Completing the event locks all judge editing."}
          </p>
          <div className="flex flex-wrap gap-2">
            {!locked && data.event.status !== "live" && (
              <Button variant="outline" onClick={() => update.mutate({ status: "live" })}>Set live</Button>
            )}
            {!locked ? (
              <Button
                onClick={() => {
                  if (confirm("Complete this event? Judges will no longer be able to change scores.")) {
                    update.mutate({ status: "completed" });
                  }
                }}
              >
                <Lock className="mr-2 h-4 w-4" /> Complete event
              </Button>
            ) : (
              <Button variant="outline" onClick={() => update.mutate({ status: "live" })}>Re-open for judging</Button>
            )}
            <Button variant="outline" asChild>
              <a href={`/print/${data.event.id}`} target="_blank" rel="noreferrer">
                <Printer className="mr-2 h-4 w-4" /> Print / PDF
              </a>
            </Button>
          </div>
        </Card>

        <Card className="border-destructive/40">
          <h2 className="mb-2 text-lg font-semibold text-destructive">Delete event</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            This permanently deletes the event, judges, device associations, participants, mark sheet, all scores,
            rankings and results. This action cannot be undone.
          </p>
          {!confirming ? (
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete this event
            </Button>
          ) : (
            <div className="space-y-3">
              <Label>Type <span className="font-semibold text-foreground">{data.event.name}</span> to confirm</Label>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={confirmName.trim() !== data.event.name}
                  onClick={async () => {
                    await del({ data: { id: data.event.id } });
                    toast.success("Event deleted");
                    router.navigate({ to: "/" });
                  }}
                >
                  Delete permanently
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Judges ---------------- */

function JudgesTab({ data }: { data: EventSnapshot }) {
  const refresh = useRefresh(data.event.id);
  const add = useServerFn(addJudge);
  const rename = useServerFn(renameJudge);
  const remove = useServerFn(removeJudge);
  const device = useServerFn(setJudgeDevice);
  const [name, setName] = useState("");

  async function run(fn: () => Promise<unknown>, msg: string) {
    try { await fn(); refresh(); toast.success(msg); } catch { toast.error("Action failed"); }
  }

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Add judge</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await run(() => add({ data: { eventId: data.event.id, name: name.trim() } }), "Judge added");
            setName("");
          }}
        >
          <Input className="max-w-xs" placeholder="Judge name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit"><Plus className="mr-2 h-4 w-4" /> Add</Button>
        </form>
      </Card>

      <div className="grid gap-3">
        {data.judges.length === 0 && <p className="text-muted-foreground">No judges yet for this event.</p>}
        {data.judges.map((j, i) => (
          <Card key={j.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="score-num text-sm text-muted-foreground">Judge {String(i + 1).padStart(2, "0")}</span>
              <Input
                className="w-52"
                defaultValue={j.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== j.name) run(() => rename({ data: { id: j.id, name: v } }), "Judge renamed");
                }}
              />
              <DeviceBadge status={j.device_status} />
            </div>
            <div className="flex flex-wrap gap-2">
              {j.device_status === "pending" && (
                <>
                  <Button size="sm" onClick={() => run(() => device({ data: { id: j.id, action: "approve" } }), "Device approved")}>
                    <Check className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => run(() => device({ data: { id: j.id, action: "reject" } }), "Device rejected")}>
                    <X className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </>
              )}
              {j.device_status === "approved" && (
                <Button size="sm" variant="outline" onClick={() => run(() => device({ data: { id: j.id, action: "reset" } }), "Device reset")}>
                  <RotateCcw className="mr-1 h-4 w-4" /> Reset device
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Remove ${j.name}? Their scores will be deleted.`)) {
                    run(() => remove({ data: { id: j.id } }), "Judge removed");
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DeviceBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-[hsl(var(--success))] text-background">Device approved</Badge>;
  if (status === "pending") return <Badge className="bg-[hsl(var(--warning))] text-background">Awaiting approval</Badge>;
  return <Badge variant="secondary">No device</Badge>;
}

/* ---------------- Participants ---------------- */

function ParticipantsTab({ data }: { data: EventSnapshot }) {
  const refresh = useRefresh(data.event.id);
  const add = useServerFn(addParticipant);
  const update = useServerFn(updateParticipant);
  const remove = useServerFn(removeParticipant);
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");

  async function run(fn: () => Promise<unknown>, msg: string) {
    try { await fn(); refresh(); toast.success(msg); } catch { toast.error("Action failed"); }
  }

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Add participant</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await run(
              () => add({ data: { eventId: data.event.id, name: name.trim(), details: details.trim() || undefined } }),
              "Participant added",
            );
            setName("");
            setDetails("");
          }}
        >
          <Input className="max-w-xs" placeholder="Participant name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="max-w-sm" placeholder="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
          <Button type="submit"><Plus className="mr-2 h-4 w-4" /> Add</Button>
        </form>
      </Card>

      <div className="grid gap-3">
        {data.participants.length === 0 && <p className="text-muted-foreground">No participants yet.</p>}
        {data.participants.map((p, i) => (
          <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="score-num text-sm text-muted-foreground">#{i + 1}</span>
              <Input
                className="w-52"
                defaultValue={p.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== p.name) run(() => update({ data: { id: p.id, name: v } }), "Participant updated");
                }}
              />
              <Input
                className="w-64"
                placeholder="Details"
                defaultValue={p.details ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (p.details ?? "")) run(() => update({ data: { id: p.id, details: v || null } }), "Participant updated");
                }}
              />
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={i === 0}
                onClick={async () => {
                  const prev = data.participants[i - 1]!;
                  await update({ data: { id: p.id, position: prev.position } });
                  await update({ data: { id: prev.id, position: p.position } });
                  refresh();
                }}>↑</Button>
              <Button size="sm" variant="ghost" disabled={i === data.participants.length - 1}
                onClick={async () => {
                  const next = data.participants[i + 1]!;
                  await update({ data: { id: p.id, position: next.position } });
                  await update({ data: { id: next.id, position: p.position } });
                  refresh();
                }}>↓</Button>
              <Button size="sm" variant="ghost"
                onClick={() => {
                  if (confirm(`Remove ${p.name}? Their scores will be deleted.`)) {
                    run(() => remove({ data: { id: p.id } }), "Participant removed");
                  }
                }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Criteria ---------------- */

function CriteriaTab({ data }: { data: EventSnapshot }) {
  const refresh = useRefresh(data.event.id);
  const add = useServerFn(addCriterion);
  const update = useServerFn(updateCriterion);
  const remove = useServerFn(removeCriterion);
  const [name, setName] = useState("");
  const [max, setMax] = useState("10");

  async function run(fn: () => Promise<unknown>, msg: string) {
    try { await fn(); refresh(); toast.success(msg); } catch { toast.error("Action failed"); }
  }

  return (
    <div className="mt-6 space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Maximum score</h2>
        <span className="score-num text-3xl font-bold text-primary">{maxTotal(data.criteria)}</span>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Add criterion</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const m = Number(max);
            if (!name.trim() || !Number.isFinite(m) || m < 1) return;
            await run(() => add({ data: { eventId: data.event.id, name: name.trim(), max_marks: m } }), "Criterion added");
            setName("");
            setMax("10");
          }}
        >
          <Input className="max-w-xs" placeholder="Criterion name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="w-32" type="number" min={1} placeholder="Max marks" value={max} onChange={(e) => setMax(e.target.value)} />
          <Button type="submit"><Plus className="mr-2 h-4 w-4" /> Add</Button>
        </form>
      </Card>

      <div className="grid gap-3">
        {data.criteria.length === 0 && <p className="text-muted-foreground">No criteria yet — judges need at least one.</p>}
        {data.criteria.map((c, i) => (
          <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="score-num text-sm text-muted-foreground">#{i + 1}</span>
              <Input
                className="w-56"
                defaultValue={c.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.name) run(() => update({ data: { id: c.id, name: v } }), "Criterion renamed");
                }}
              />
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Max</Label>
                <Input
                  className="w-24"
                  type="number"
                  min={1}
                  defaultValue={c.max_marks}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 1 && v !== c.max_marks) {
                      run(() => update({ data: { id: c.id, max_marks: v } }), "Max marks updated");
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={i === 0}
                onClick={async () => {
                  const prev = data.criteria[i - 1]!;
                  await update({ data: { id: c.id, position: prev.position } });
                  await update({ data: { id: prev.id, position: c.position } });
                  refresh();
                }}>↑</Button>
              <Button size="sm" variant="ghost" disabled={i === data.criteria.length - 1}
                onClick={async () => {
                  const next = data.criteria[i + 1]!;
                  await update({ data: { id: c.id, position: next.position } });
                  await update({ data: { id: next.id, position: c.position } });
                  refresh();
                }}>↓</Button>
              <Button size="sm" variant="ghost"
                onClick={() => {
                  if (confirm(`Delete "${c.name}"? Related marks will be deleted.`)) {
                    run(() => remove({ data: { id: c.id } }), "Criterion deleted");
                  }
                }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Progress ---------------- */

function ProgressTab({ data }: { data: EventSnapshot }) {
  const stats = progressStats(data);
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Participants" value={data.participants.length} />
        <Stat label="Judges" value={data.judges.length} />
        <Stat label="Completed" value={stats.done} />
        <Stat label="Pending" value={stats.pending} />
      </div>

      {data.judges.length === 0 || data.participants.length === 0 ? (
        <p className="text-muted-foreground">Add judges and participants to track progress.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-3 text-left font-medium">Participant</th>
                {data.judges.map((j) => <th key={j.id} className="p-3 text-left font-medium">{j.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.participants.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-3 font-medium">{p.name}</td>
                  {data.judges.map((j) => (
                    <td key={j.id} className="p-3">
                      {hasSubmission(data.scores, j.id, p.id) ? (
                        <span className="inline-flex items-center gap-1 text-[hsl(var(--success))]">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="score-num">{judgeTotalFor(data.scores, j.id, p.id)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Pending</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="score-num mt-1 text-3xl font-bold">{value}</p>
    </Card>
  );
}

/* ---------------- Results ---------------- */

function ResultsTab({ data }: { data: EventSnapshot }) {
  const ranked = useMemo(() => rankParticipants(data), [data]);
  const podium = ranked.filter((r) => r.rank <= 3);
  const rest = ranked.filter((r) => r.rank > 3);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Final ranking</h2>
        <Button variant="outline" asChild>
          <a href={`/print/${data.event.id}`} target="_blank" rel="noreferrer">
            <Printer className="mr-2 h-4 w-4" /> Print / Download PDF
          </a>
        </Button>
      </div>

      {ranked.length === 0 ? (
        <p className="text-muted-foreground">No participants yet.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {podium.map((r) => (
              <Card key={r.participant.id} className={`text-center ${podiumClass(r.rank)}`}>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{ordinal(r.rank)} place</p>
                <p className="mt-1 text-xl font-bold">{r.participant.name}</p>
                <p className="score-num mt-1 text-3xl font-bold">{r.finalScore}</p>
              </Card>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-3 text-left font-medium">Rank</th>
                  <th className="p-3 text-left font-medium">Participant</th>
                  {data.judges.map((j) => <th key={j.id} className="p-3 text-left font-medium">{j.name}</th>)}
                  <th className="p-3 text-left font-medium">Final</th>
                </tr>
              </thead>
              <tbody>
                {[...podium, ...rest].map((r) => (
                  <tr key={r.participant.id} className="border-t border-border">
                    <td className="score-num p-3">{r.rank}</td>
                    <td className="p-3 font-medium">{r.participant.name}</td>
                    {data.judges.map((j) => (
                      <td key={j.id} className="score-num p-3">{r.judgeTotals[j.id] ?? "—"}</td>
                    ))}
                    <td className="score-num p-3 font-semibold">{r.finalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Final score = average of the totals submitted by judges. Exact ties share a joint position.
          </p>
        </>
      )}
    </div>
  );
}

function podiumClass(rank: number) {
  if (rank === 1) return "border-[hsl(var(--gold))]";
  if (rank === 2) return "border-[hsl(var(--silver))]";
  return "border-[hsl(var(--bronze))]";
}

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}
