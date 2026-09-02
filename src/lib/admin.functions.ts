import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import type { EventSnapshot } from "./scoring";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireAdmin() {
  const { ADMIN_COOKIE, readCookie, verifyAdminToken } = await import("./judging.server");
  const token = readCookie(getRequestHeader("cookie"), ADMIN_COOKIE);
  if (!verifyAdminToken(token)) throw new Error("Not signed in as admin");
}

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { ADMIN_COOKIE, readCookie, verifyAdminToken } = await import("./judging.server");
  const configured = Boolean(process.env["ADMIN_PASSWORD"]);
  if (!configured) return { authed: false, configured };
  return {
    authed: verifyAdminToken(readCookie(getRequestHeader("cookie"), ADMIN_COOKIE)),
    configured,
  };
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => z.object({ password: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { ADMIN_COOKIE, checkPassword, issueAdminToken } = await import("./judging.server");
    if (!checkPassword(data.password)) return { ok: false as const, error: "Incorrect password" };
    setResponseHeader(
      "set-cookie",
      `${ADMIN_COOKIE}=${issueAdminToken()}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=86400`,
    );
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { ADMIN_COOKIE } = await import("./judging.server");
  setResponseHeader("set-cookie", `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
  return { ok: true };
});

export const listEvents = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const db = await admin();
  const { data, error } = await db
    .from("events")
    .select("id, name, event_date, venue, status, join_code, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createEvent = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; event_date?: string; venue?: string; description?: string }) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        event_date: z.string().max(20).optional(),
        venue: z.string().trim().max(160).optional(),
        description: z.string().trim().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { makeJoinCode } = await import("./judging.server");
    const db = await admin();
    const { data: row, error } = await db
      .from("events")
      .insert({
        name: data.name,
        event_date: data.event_date || null,
        venue: data.venue || null,
        description: data.description || null,
        join_code: makeJoinCode(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const updateEvent = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      name?: string;
      event_date?: string | null;
      venue?: string | null;
      description?: string | null;
      status?: string;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          name: z.string().trim().min(1).max(120).optional(),
          event_date: z.string().max(20).nullable().optional(),
          venue: z.string().max(160).nullable().optional(),
          description: z.string().max(1000).nullable().optional(),
          status: z.enum(["setup", "live", "completed"]).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { id, ...rest } = data;
    const db = await admin();
    const { error } = await db
      .from("events")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await admin();
    const { error } = await db.from("events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Full event snapshot for the admin dashboard. */
export const getEventSnapshot = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<EventSnapshot> => {
    await requireAdmin();
    const db = await admin();
    const [ev, judges, participants, criteria, scores] = await Promise.all([
      db.from("events").select("*").eq("id", data.id).maybeSingle(),
      db.from("judges").select("*").eq("event_id", data.id).order("created_at"),
      db.from("participants").select("*").eq("event_id", data.id).order("position"),
      db.from("criteria").select("*").eq("event_id", data.id).order("position"),
      db.from("scores").select("judge_id, participant_id, criterion_id, value").eq("event_id", data.id),
    ]);
    if (!ev.data) throw new Error("Event not found");
    return {
      event: ev.data as EventSnapshot["event"],
      judges: (judges.data ?? []).map((j) => ({
        id: j.id as string,
        name: j.name as string,
        device_status: j.device_status as string,
        has_device: Boolean(j.device_token),
      })),
      participants: (participants.data ?? []) as EventSnapshot["participants"],
      criteria: ((criteria.data ?? []) as CriterionDb[]).map((c) => ({
        id: c.id,
        name: c.name,
        max_marks: Number(c.max_marks),
        position: c.position,
      })),
      scores: ((scores.data ?? []) as ScoreDb[]).map((s) => ({
        judge_id: s.judge_id,
        participant_id: s.participant_id,
        criterion_id: s.criterion_id,
        value: Number(s.value),
      })),
    };
  });

interface CriterionDb {
  id: string;
  name: string;
  max_marks: number | string;
  position: number;
}
interface ScoreDb {
  judge_id: string;
  participant_id: string;
  criterion_id: string;
  value: number | string;
}

/* ---------------- Judges ---------------- */

export const addJudge = createServerFn({ method: "POST" })
  .inputValidator((d: { eventId: string; name: string }) =>
    z.object({ eventId: z.string().uuid(), name: z.string().trim().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await admin();
    const { error } = await db.from("judges").insert({ event_id: data.eventId, name: data.name });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameJudge = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await admin();
    const { error } = await db.from("judges").update({ name: data.name }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeJudge = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await admin();
    const { error } = await db.from("judges").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setJudgeDevice = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; action: "approve" | "reject" | "reset" }) =>
    z.object({ id: z.string().uuid(), action: z.enum(["approve", "reject", "reset"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await admin();
    const patch =
      data.action === "approve"
        ? { device_status: "approved" }
        : { device_status: "unbound", device_token: null };
    const { error } = await db.from("judges").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Participants ---------------- */

export const addParticipant = createServerFn({ method: "POST" })
  .inputValidator((d: { eventId: string; name: string; details?: string }) =>
    z
      .object({
        eventId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        details: z.string().trim().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await admin();
    const { count } = await db
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.eventId);
    const { error } = await db.from("participants").insert({
      event_id: data.eventId,
      name: data.name,
      details: data.details || null,
      position: count ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateParticipant = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; name?: string; details?: string | null; position?: number }) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        details: z.string().max(300).nullable().optional(),
        position: z.number().int().min(0).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { id, ...rest } = data;
    const db = await admin();
    const { error } = await db.from("participants").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeParticipant = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await admin();
    const { error } = await db.from("participants").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Criteria ---------------- */

export const addCriterion = createServerFn({ method: "POST" })
  .inputValidator((d: { eventId: string; name: string; max_marks: number }) =>
    z
      .object({
        eventId: z.string().uuid(),
        name: z.string().trim().min(1).max(80),
        max_marks: z.number().min(1).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await admin();
    const { count } = await db
      .from("criteria")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.eventId);
    const { error } = await db.from("criteria").insert({
      event_id: data.eventId,
      name: data.name,
      max_marks: data.max_marks,
      position: count ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCriterion = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; name?: string; max_marks?: number; position?: number }) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(80).optional(),
        max_marks: z.number().min(1).max(1000).optional(),
        position: z.number().int().min(0).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { id, ...rest } = data;
    const db = await admin();
    const { error } = await db.from("criteria").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeCriterion = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await admin();
    const { error } = await db.from("criteria").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
