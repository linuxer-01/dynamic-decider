import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { CriterionRow, ParticipantRow, ScoreRow } from "./scoring";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

interface JudgeEventRow {
  id: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  status: string;
}

export interface JudgeSession {
  event: JudgeEventRow;
  judge: { id: string; name: string; device_status: string };
  participants: ParticipantRow[];
  criteria: CriterionRow[];
  myScores: ScoreRow[];
}

/** Step 1: look up an event by join code and list its judges. */
export const lookupEvent = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; deviceToken: string }) =>
    z.object({ code: z.string().trim().min(4).max(12), deviceToken: z.string().min(8).max(80) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: ev } = await db
      .from("events")
      .select("id, name, event_date, venue, status")
      .eq("join_code", data.code.toUpperCase())
      .maybeSingle();
    if (!ev) return { ok: false as const, error: "No event found for that code." };

    const { data: judges } = await db
      .from("judges")
      .select("id, name, device_token, device_status")
      .eq("event_id", ev.id)
      .order("created_at");

    const rows = (judges ?? []) as { id: string; name: string; device_token: string | null; device_status: string }[];
    const mine = rows.find((j) => j.device_token === data.deviceToken);
    return {
      ok: true as const,
      event: ev as JudgeEventRow,
      boundJudgeId: mine?.id ?? null,
      judges: rows.map((j) => ({
        id: j.id,
        name: j.name,
        taken: Boolean(j.device_token) && j.device_token !== data.deviceToken,
        status: j.device_status,
      })),
    };
  });

/** Step 2: claim a judge slot with this device. */
export const claimJudge = createServerFn({ method: "POST" })
  .inputValidator((d: { judgeId: string; deviceToken: string }) =>
    z.object({ judgeId: z.string().uuid(), deviceToken: z.string().min(8).max(80) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: judge } = await db
      .from("judges")
      .select("id, event_id, device_token")
      .eq("id", data.judgeId)
      .maybeSingle();
    if (!judge) return { ok: false as const, error: "Judge not found." };

    // One device = one judge, per event.
    const { data: others } = await db
      .from("judges")
      .select("id, name")
      .eq("event_id", judge.event_id)
      .eq("device_token", data.deviceToken);
    const conflict = (others ?? []).find((o) => o.id !== judge.id);
    if (conflict) {
      return {
        ok: false as const,
        error: "This device is already assigned to another judge. Please contact the Admin.",
      };
    }
    if (judge.device_token && judge.device_token !== data.deviceToken) {
      return {
        ok: false as const,
        error: "This judge is already assigned to another device. Please contact the Admin.",
      };
    }

    const { error } = await db
      .from("judges")
      .update({
        device_token: data.deviceToken,
        device_status: "pending",
        requested_at: new Date().toISOString(),
      })
      .eq("id", judge.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Step 3: the judge's own working set. */
export const judgeSession = createServerFn({ method: "POST" })
  .inputValidator((d: { judgeId: string; deviceToken: string }) =>
    z.object({ judgeId: z.string().uuid(), deviceToken: z.string().min(8).max(80) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: false; error: string } | { ok: true; session: JudgeSession }> => {
    const db = await admin();
    const { data: judge } = await db
      .from("judges")
      .select("id, name, event_id, device_token, device_status")
      .eq("id", data.judgeId)
      .maybeSingle();
    if (!judge || judge.device_token !== data.deviceToken) {
      return { ok: false, error: "This device is not registered for that judge." };
    }

    const [ev, participants, criteria, scores] = await Promise.all([
      db.from("events").select("id, name, event_date, venue, status").eq("id", judge.event_id).maybeSingle(),
      db.from("participants").select("*").eq("event_id", judge.event_id).order("position"),
      db.from("criteria").select("*").eq("event_id", judge.event_id).order("position"),
      db.from("scores").select("judge_id, participant_id, criterion_id, value").eq("judge_id", judge.id),
    ]);
    if (!ev.data) return { ok: false, error: "Event no longer exists." };

    return {
      ok: true,
      session: {
        event: ev.data as JudgeEventRow,
        judge: { id: judge.id as string, name: judge.name as string, device_status: judge.device_status as string },
        participants: (participants.data ?? []) as ParticipantRow[],
        criteria: ((criteria.data ?? []) as { id: string; name: string; max_marks: number | string; position: number }[]).map(
          (c) => ({ id: c.id, name: c.name, max_marks: Number(c.max_marks), position: c.position }),
        ),
        myScores: ((scores.data ?? []) as { judge_id: string; participant_id: string; criterion_id: string; value: number | string }[]).map(
          (s) => ({
            judge_id: s.judge_id,
            participant_id: s.participant_id,
            criterion_id: s.criterion_id,
            value: Number(s.value),
          }),
        ),
      },
    };
  });

/** Step 4: submit or update one participant's marks. */
export const submitScores = createServerFn({ method: "POST" })
  .inputValidator((d: { judgeId: string; deviceToken: string; participantId: string; values: { criterionId: string; value: number }[] }) =>
    z
      .object({
        judgeId: z.string().uuid(),
        deviceToken: z.string().min(8).max(80),
        participantId: z.string().uuid(),
        values: z
          .array(z.object({ criterionId: z.string().uuid(), value: z.number().min(0).max(1000) }))
          .min(1)
          .max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: judge } = await db
      .from("judges")
      .select("id, event_id, device_token, device_status")
      .eq("id", data.judgeId)
      .maybeSingle();
    if (!judge || judge.device_token !== data.deviceToken) {
      return { ok: false as const, error: "This device is not registered for that judge." };
    }
    if (judge.device_status !== "approved") {
      return { ok: false as const, error: "Your device has not been approved by the Admin yet." };
    }

    const { data: ev } = await db.from("events").select("status").eq("id", judge.event_id).maybeSingle();
    if (!ev) return { ok: false as const, error: "Event no longer exists." };
    if (ev.status === "completed") {
      return { ok: false as const, error: "This event is completed. Scores are locked." };
    }

    const { data: participant } = await db
      .from("participants")
      .select("id, event_id")
      .eq("id", data.participantId)
      .maybeSingle();
    if (!participant || participant.event_id !== judge.event_id) {
      return { ok: false as const, error: "Participant is not part of this event." };
    }

    const { data: criteria } = await db
      .from("criteria")
      .select("id, max_marks")
      .eq("event_id", judge.event_id);
    const maxById = new Map(
      ((criteria ?? []) as { id: string; max_marks: number | string }[]).map((c) => [c.id, Number(c.max_marks)]),
    );

    const rows = [];
    for (const entry of data.values) {
      const max = maxById.get(entry.criterionId);
      if (max === undefined) return { ok: false as const, error: "Unknown criterion in submission." };
      if (entry.value < 0 || entry.value > max) {
        return { ok: false as const, error: `Marks must be between 0 and ${max}.` };
      }
      rows.push({
        event_id: judge.event_id,
        judge_id: judge.id,
        participant_id: data.participantId,
        criterion_id: entry.criterionId,
        value: entry.value,
        submitted_at: new Date().toISOString(),
      });
    }

    const { error } = await db
      .from("scores")
      .upsert(rows, { onConflict: "judge_id,participant_id,criterion_id" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
