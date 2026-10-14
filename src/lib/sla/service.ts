import { db } from '@/lib/db'

type SuggestionForSla = {
  id: string
  customer_id?: string | null
  due_at?: Date | string | null
  source_ref_type?: string | null
  created_at?: Date | string | null
  metadata_json?: any
}

type LevelView = {
  id: string
  level_key: string
  level_name: string
  sort_order: number
  trigger_type: string
  trigger_minutes: number
  cooldown_minutes: number
  notify_type?: string | null
  notify_targets_json?: any
  is_active: boolean
}

type PolicyView = {
  id: string
  policy_key: string
  name: string
  is_active: boolean
  priority: number
  target_minutes: number
  match_json?: any
  levels: LevelView[]
}

export async function listActiveSlaPolicies(): Promise<PolicyView[]> {
  const rows = await (db as any).slaPolicy.findMany({
    where: { is_active: true },
    orderBy: [{ priority: 'desc' }, { created_at: 'asc' }],
    include: {
      levels: {
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      },
    },
  })
  return rows as PolicyView[]
}

function policyMatchesSuggestion(policy: PolicyView, suggestion: SuggestionForSla) {
  const match = policy?.match_json
  if (!match || typeof match !== 'object') return true

  const sourceRefTypes = Array.isArray((match as any).source_ref_types) ? (match as any).source_ref_types : []
  if (sourceRefTypes.length) {
    const srt = String(suggestion.source_ref_type || '').trim()
    if (!sourceRefTypes.includes(srt)) return false
  }

  const internalOnly = Boolean((match as any).internal_only)
  if (internalOnly) {
    const internal = Boolean(suggestion.customer_id == null || (suggestion.metadata_json && suggestion.metadata_json.is_internal))
    if (!internal) return false
  }

  return true
}

export async function resolveSlaPolicyForSuggestion(suggestion: SuggestionForSla): Promise<PolicyView | null> {
  const policies = await listActiveSlaPolicies()
  for (const p of policies) {
    if (policyMatchesSuggestion(p, suggestion)) return p
  }
  return null
}

export function computeSlaDueAt(suggestion: SuggestionForSla, policy: PolicyView | null): Date | null {
  if (suggestion.due_at) return new Date(suggestion.due_at)
  if (!policy) return null
  const createdAt = suggestion.created_at ? new Date(suggestion.created_at) : new Date()
  const due = new Date(createdAt)
  due.setMinutes(due.getMinutes() + Number(policy.target_minutes || 0))
  return due
}

export function evaluateSlaLevel(levels: LevelView[], effectiveDueAt: Date | null, now = new Date()) {
  if (!effectiveDueAt) {
    return {
      level_key: null as string | null,
      level_name: null as string | null,
      minutes_to_due: null as number | null,
    }
  }

  const deltaMinutes = Math.floor((effectiveDueAt.getTime() - now.getTime()) / 60000)
  let matched: LevelView | null = null
  for (const lv of levels) {
    const trigMin = Number(lv.trigger_minutes || 0)
    const trigType = String(lv.trigger_type || '').trim().toLowerCase()
    if (trigType === 'before_due') {
      if (deltaMinutes > 0 && deltaMinutes <= trigMin) {
        matched = lv
      }
    } else if (trigType === 'after_due') {
      if (deltaMinutes <= -trigMin) {
        matched = lv
      }
    }
  }

  return {
    level_key: matched?.level_key || null,
    level_name: matched?.level_name || null,
    minutes_to_due: deltaMinutes,
  }
}

export async function buildSlaSnapshotForSuggestion(suggestionId: string) {
  const suggestion = await (db as any).workSuggestion.findUnique({
    where: { id: suggestionId },
    select: {
      id: true,
      customer_id: true,
      due_at: true,
      source_ref_type: true,
      created_at: true,
      metadata_json: true,
      sla_due_at: true,
      sla_policy_key: true,
      current_sla_level_key: true,
    },
  })
  if (!suggestion) return null

  const policy = await resolveSlaPolicyForSuggestion(suggestion as SuggestionForSla)
  const effectiveDueAt = computeSlaDueAt(suggestion as SuggestionForSla, policy)
  const evalResult = evaluateSlaLevel(policy?.levels || [], effectiveDueAt, new Date())

  return {
    suggestion_id: suggestion.id,
    policy_key: policy?.policy_key || null,
    target_minutes: policy?.target_minutes || null,
    effective_due_at: effectiveDueAt ? effectiveDueAt.toISOString() : null,
    level_key: evalResult.level_key,
    level_name: evalResult.level_name,
    minutes_to_due: evalResult.minutes_to_due,
    current_sla_level_key: suggestion.current_sla_level_key || null,
  }
}

function nextCheckFromNow(minutes = 10) {
  const d = new Date()
  d.setMinutes(d.getMinutes() + minutes)
  return d
}

function computeEscalatedAt(levelKey: string | null, now = new Date()) {
  return levelKey ? now : null
}

export async function runSlaEscalationPass(params?: { limit?: number; now?: Date }) {
  const limit = Math.max(1, Math.min(1000, Number(params?.limit || 400)))
  const now = params?.now || new Date()
  const openStatuses = ['pending', 'accepted', 'assigned']

  const suggestions = await (db as any).workSuggestion.findMany({
    where: {
      status: { in: openStatuses },
    },
    orderBy: [{ next_escalation_check_at: 'asc' }, { created_at: 'asc' }],
    take: limit,
    select: {
      id: true,
      customer_id: true,
      status: true,
      due_at: true,
      source_ref_type: true,
      created_at: true,
      metadata_json: true,
      sla_due_at: true,
      sla_policy_key: true,
      current_sla_level_key: true,
    },
  })

  let levelChangedCount = 0
  let slaResolvedCount = 0
  let checkedCount = 0

  for (const s of suggestions) {
    checkedCount += 1
    const policy = await resolveSlaPolicyForSuggestion(s as any)
    const effectiveDueAt = computeSlaDueAt(s as any, policy)
    if (effectiveDueAt) slaResolvedCount += 1

    const evalResult = evaluateSlaLevel(policy?.levels || [], effectiveDueAt, now)
    const prevLevel = String(s.current_sla_level_key || '').trim() || null
    const nextLevel = evalResult.level_key
    const dueIso = effectiveDueAt ? effectiveDueAt.toISOString() : null
    const policyKey = policy?.policy_key || null

    await (db as any).workSuggestion.update({
      where: { id: s.id },
      data: {
        sla_policy_key: policyKey,
        sla_due_at: dueIso ? new Date(dueIso) : null,
        current_sla_level_key: nextLevel,
        escalated_at: computeEscalatedAt(nextLevel, now),
        next_escalation_check_at: nextCheckFromNow(10),
      },
    })

    if (prevLevel !== nextLevel) {
      levelChangedCount += 1
      await (db as any).slaEscalationLog.create({
        data: {
          work_suggestion_id: s.id,
          policy_id: policy?.id || null,
          policy_key: policyKey,
          from_level_key: prevLevel,
          to_level_key: nextLevel,
          reason: 'silent_recalc',
          snapshot_json: {
            effective_due_at: dueIso,
            minutes_to_due: evalResult.minutes_to_due,
            level_name: evalResult.level_name,
          },
          triggered_by: 'system',
        },
      })

      await (db as any).actionTimelineEvent.create({
        data: {
          work_suggestion_id: s.id,
          customer_id: s.customer_id || null,
          event_key: 'sla_level_changed',
          title: 'Cap nhat muc SLA',
          description: `Muc cu: ${prevLevel || '(none)'} -> muc moi: ${nextLevel || '(none)'}`,
          metadata_json: {
            policy_key: policyKey,
            effective_due_at: dueIso,
            minutes_to_due: evalResult.minutes_to_due,
            level_name: evalResult.level_name,
            silent_mode: true,
          },
          actor_user_id: null,
        },
      })
    }
  }

  return {
    checked_count: checkedCount,
    sla_resolved_count: slaResolvedCount,
    level_changed_count: levelChangedCount,
    silent_mode: true,
    run_at: now.toISOString(),
  }
}
