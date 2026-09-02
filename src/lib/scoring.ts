export interface EventRow {
  id: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  description: string | null;
  join_code: string;
  status: string;
  tie_mode: string;
}

export interface JudgeRow {
  id: string;
  name: string;
  device_status: string;
  has_device: boolean;
}

export interface ParticipantRow {
  id: string;
  name: string;
  details: string | null;
  position: number;
}

export interface CriterionRow {
  id: string;
  name: string;
  max_marks: number;
  position: number;
}

export interface ScoreRow {
  judge_id: string;
  participant_id: string;
  criterion_id: string;
  value: number;
}

export interface EventSnapshot {
  event: EventRow;
  judges: JudgeRow[];
  participants: ParticipantRow[];
  criteria: CriterionRow[];
  scores: ScoreRow[];
}

export interface RankedParticipant {
  participant: ParticipantRow;
  judgeTotals: Record<string, number | null>;
  finalScore: number;
  judgesScored: number;
  rank: number;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function maxTotal(criteria: CriterionRow[]): number {
  return criteria.reduce((sum, c) => sum + Number(c.max_marks), 0);
}

export function hasSubmission(
  scores: ScoreRow[],
  judgeId: string,
  participantId: string,
): boolean {
  return scores.some((s) => s.judge_id === judgeId && s.participant_id === participantId);
}

export function judgeTotalFor(
  scores: ScoreRow[],
  judgeId: string,
  participantId: string,
): number | null {
  const rows = scores.filter((s) => s.judge_id === judgeId && s.participant_id === participantId);
  if (rows.length === 0) return null;
  return round2(rows.reduce((sum, r) => sum + Number(r.value), 0));
}

/** Ranks participants by average of judge totals. Ties share a rank (joint position). */
export function rankParticipants(snapshot: EventSnapshot): RankedParticipant[] {
  const { participants, judges, scores } = snapshot;

  const rows = participants.map((participant) => {
    const judgeTotals: Record<string, number | null> = {};
    let sum = 0;
    let count = 0;
    for (const judge of judges) {
      const total = judgeTotalFor(scores, judge.id, participant.id);
      judgeTotals[judge.id] = total;
      if (total !== null) {
        sum += total;
        count += 1;
      }
    }
    return {
      participant,
      judgeTotals,
      judgesScored: count,
      finalScore: count > 0 ? round2(sum / count) : 0,
      rank: 0,
    };
  });

  rows.sort((a, b) => b.finalScore - a.finalScore || a.participant.name.localeCompare(b.participant.name));

  let lastScore: number | null = null;
  let lastRank = 0;
  rows.forEach((row, index) => {
    if (lastScore !== null && row.finalScore === lastScore) {
      row.rank = lastRank;
    } else {
      row.rank = index + 1;
      lastRank = row.rank;
      lastScore = row.finalScore;
    }
  });

  return rows;
}

export function progressStats(snapshot: EventSnapshot) {
  const total = snapshot.judges.length * snapshot.participants.length;
  let done = 0;
  for (const judge of snapshot.judges) {
    for (const p of snapshot.participants) {
      if (hasSubmission(snapshot.scores, judge.id, p.id)) done += 1;
    }
  }
  return { total, done, pending: Math.max(0, total - done) };
}
