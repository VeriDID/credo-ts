import { createHash } from 'crypto'
import { AgentConfig, AgentContext, EventEmitter, injectable } from '@credo-ts/core'
import { DidCommMessageSender, DidCommOutboundMessageContext } from '@credo-ts/didcomm'
import { DidCommConnectionService } from '@credo-ts/didcomm'
import { WorkflowEventTypes } from '../WorkflowEvents'
import { WorkflowModuleConfig } from '../WorkflowModuleConfig'
import {
  ActionRegistry,
  IssueCredentialV2Action,
  LocalStateSetAction,
  PresentProofV2Action,
} from '../actions/ActionRegistry'
import { GuardEvaluator } from '../engine/GuardEvaluator'
import { validateTemplateJson, validateTemplateRefs } from '../model/TemplateValidation'
import type { Participants, WorkflowInstanceData, WorkflowTemplate } from '../model/types'
import { ensureArray, findSectionForState, transitionsFromState } from '../model/types'
import { CompleteMessage } from '../protocol/messages/CompleteMessage'
import { WorkflowInstanceRecord } from '../repository/WorkflowInstanceRecord'
import { WorkflowInstanceRepository } from '../repository/WorkflowInstanceRepository'
import { WorkflowTemplateRecord } from '../repository/WorkflowTemplateRecord'
import { WorkflowTemplateRepository } from '../repository/WorkflowTemplateRepository'

const stableStringify = (obj: any): string => {
  const allKeys: string[] = []
  JSON.stringify(obj, (k, v) => (allKeys.push(k), v))
  allKeys.sort()
  return JSON.stringify(obj, allKeys)
}

const sha256 = (input: string): string => createHash('sha256').update(input).digest('hex')

@injectable()
export class WorkflowService {
  private readonly actions: ActionRegistry

  public constructor(
    private readonly templateRepo: WorkflowTemplateRepository,
    private readonly instanceRepo: WorkflowInstanceRepository,
    private readonly config: WorkflowModuleConfig,
    private readonly agentConfig: AgentConfig,
    private readonly eventEmitter?: EventEmitter
  ) {
    this.actions = new ActionRegistry()
    this.actions.register(new LocalStateSetAction())
    // Register DIDComm action handlers used by workflows
    this.actions.register(new IssueCredentialV2Action())
    this.actions.register(new PresentProofV2Action())
  }

  public async publishTemplate(
    agentContext: AgentContext,
    template: WorkflowTemplate
  ): Promise<WorkflowTemplateRecord> {
    // JSON schema validation + structural checks
    validateTemplateJson(template as any)
    validateTemplateRefs(template)
    const hash = sha256(stableStringify(template))
    const existing = await this.templateRepo.findByTemplateIdAndVersion(
      agentContext,
      template.template_id,
      template.version
    )
    if (existing) {
      existing.template = template
      existing.hash = hash
      await this.templateRepo.update(agentContext, existing)
      return existing
    }
    const record = new WorkflowTemplateRecord({ template, hash })
    await this.templateRepo.save(agentContext, record)
    return record
  }

  public async start(
    agentContext: AgentContext,
    opts: {
      template_id: string
      template_version?: string
      instance_id?: string
      connection_id?: string
      participants?: Participants
      context?: Record<string, unknown>
    }
  ): Promise<WorkflowInstanceRecord> {
    const tplRec = await this.templateRepo.findByTemplateIdAndVersion(
      agentContext,
      opts.template_id,
      opts.template_version
    )
    if (!tplRec)
      throw this.problem(
        'invalid_template',
        `template not found: ${opts.template_id}@${opts.template_version || 'latest'}`
      )
    const tpl = tplRec.template
    const startState = tpl.states.find((s) => s.type === 'start')?.name || tpl.states[0]?.name
    if (!startState) throw this.problem('invalid_template', 'no start state')

    const policy = tpl.instance_policy
    const connectionId = opts.connection_id
    if (policy.mode === 'singleton_per_connection') {
      const existing = ensureArray(
        await this.instanceRepo.findByTemplateAndConnection(agentContext, tpl.template_id, connectionId)
      ).shift()
      if (existing) {
        if (this.config.autoReturnExistingOnSingleton) return existing
        throw this.problem('already_exists', 'instance already exists for template/connection')
      }
    }

    let multiplicityKeyValue: string | undefined
    if (policy.mode === 'multi_per_connection' && policy.multiplicity_key) {
      multiplicityKeyValue = this.evalMultiplicity(policy.multiplicity_key, opts.context || {})
      const dup = ensureArray(
        await this.instanceRepo.findByTemplateConnAndMultiplicity(
          agentContext,
          tpl.template_id,
          connectionId,
          multiplicityKeyValue
        )
      ).shift()
      if (dup) return dup
    }

    const instanceId = opts.instance_id || this.uuid()
    const section = findSectionForState(tpl, startState)
    const rec = new WorkflowInstanceRecord({
      instanceId,
      templateId: tpl.template_id,
      templateVersion: tpl.version,
      connectionId,
      participants: opts.participants || {},
      state: startState,
      section,
      context: { ...(opts.context || {}) },
      artifacts: {},
      status: 'active',
      history: [],
      multiplicityKeyValue,
      idempotencyKeys: [],
    })
    await this.instanceRepo.save(agentContext, rec)
    // Emit state changed event for initial creation
    try {
      this.eventEmitter?.emit(agentContext, {
        type: WorkflowEventTypes.WorkflowInstanceStateChanged,
        payload: {
          instanceRecord: rec,
          previousState: null,
          newState: rec.state,
          event: 'start',
          actionKey: undefined,
          msgId: undefined,
        },
      })
    } catch {}
    return rec
  }

  public async advance(
    agentContext: AgentContext,
    opts: {
      instance_id: string
      event: string
      idempotency_key?: string
      input?: any
    }
  ): Promise<WorkflowInstanceRecord> {
    let inst: WorkflowInstanceRecord
    try {
      inst = await this.instanceRepo.getById(agentContext, opts.instance_id)
    } catch {
      const found = await this.instanceRepo.getByInstanceId(agentContext, opts.instance_id)
      if (!found) throw this.problem('invalid_event', 'instance not found')
      inst = found
    }
    const tplRec = await this.templateRepo.findByTemplateIdAndVersion(
      agentContext,
      inst.templateId,
      inst.templateVersion
    )
    if (!tplRec) throw this.problem('invalid_template', 'template not found for instance')
    const tpl = tplRec.template

    // lifecycle status gating
    if (inst.status === 'paused') throw this.problem('forbidden', 'instance is paused')
    if (inst.status === 'canceled') throw this.problem('forbidden', 'instance is canceled')
    if (inst.status === 'completed') throw this.problem('invalid_event', 'instance already completed')

    // idempotency
    if (opts.idempotency_key && inst.idempotencyKeys?.includes(opts.idempotency_key)) {
      const prior = (inst as any).idempotency?.find?.((i: any) => i.key === opts.idempotency_key)
      if (prior && prior.event !== opts.event) throw this.problem('idempotency_conflict', 'same key, different event')
      return inst
    }

    const candidates = transitionsFromState(tpl, inst.state).filter((t) => t.on === opts.event)
    if (!candidates.length)
      throw this.problem('invalid_event', `no transition for event ${opts.event} from ${inst.state}`)
    const env = GuardEvaluator.envFromInstance(this.toInstanceData(inst))
    const enabled = candidates.filter((t) => GuardEvaluator.evalGuard(t.guard, env))
    if (!enabled.length) throw this.problem('guard_failed', 'guard evaluated false')
    const t = enabled[0]

    let artifactsDelta: Record<string, unknown> = {}
    let messageId: string | undefined
    if (t.action) {
      const def = tpl.actions.find((a) => a.key === t.action)
      if (!def) throw this.problem('invalid_template', `action not defined: ${t.action}`)
      const handler = this.actions.get(def.typeURI)
      if (!handler) throw this.problem('action_error', `no handler for type ${def.typeURI}`)
      const result = await handler.execute({
        agentContext,
        template: tpl,
        instance: this.toInstanceData(inst),
        action: def,
        input: opts.input,
      })
      artifactsDelta = result?.artifacts || {}
      // local state:set may be applied directly by handler, but ensure we persist
      if (result?.contextMerge) inst.context = result.contextMerge
      if (result?.messageId) messageId = result.messageId
    }

    // Concurrency check: re-read and ensure state didn't change
    const fromState = inst.state
    try {
      const fresh = await this.instanceRepo.getById(agentContext, inst.id)
      if (fresh.state !== fromState) throw this.problem('state_conflict', 'state changed concurrently')
    } catch {
      // ignore if repository throws
    }

    // persist atomically (optimistic)
    const prevState = inst.state
    inst.history.push({
      ts: new Date().toISOString(),
      event: opts.event,
      from: inst.state,
      to: t.to,
      actionKey: t.action,
      msg_id: messageId,
    })
    inst.state = t.to
    inst.section = findSectionForState(tpl, t.to)
    inst.artifacts = { ...inst.artifacts, ...artifactsDelta }
    if (opts.idempotency_key) {
      inst.idempotencyKeys = [...(inst.idempotencyKeys || []), opts.idempotency_key]
      ;(inst as any).idempotency = [
        ...((inst as any).idempotency || []),
        { key: opts.idempotency_key, event: opts.event, to: t.to, actionKey: t.action },
      ]
    }
    let reachedFinal = false
    try {
      const toDef = tpl.states.find((s) => s.name === t.to)
      if (toDef?.type === 'final') {
        inst.status = 'completed'
        reachedFinal = true
      }
    } catch {}
    await this.instanceRepo.update(agentContext, inst)

    // Emit state-changed event
    try {
      this.eventEmitter?.emit(agentContext, {
        type: WorkflowEventTypes.WorkflowInstanceStateChanged,
        payload: {
          instanceRecord: inst,
          previousState: prevState,
          newState: inst.state,
          event: opts.event,
          actionKey: t.action,
          msgId: messageId,
        },
      })
    } catch {}

    // Emit status-changed & completed, and send Complete message if final
    if (reachedFinal) {
      try {
        this.eventEmitter?.emit(agentContext, {
          type: WorkflowEventTypes.WorkflowInstanceStatusChanged,
          payload: { instanceRecord: inst, previousStatus: 'active', newStatus: 'completed' },
        })
      } catch {}
      try {
        this.eventEmitter?.emit(agentContext, {
          type: WorkflowEventTypes.WorkflowInstanceCompleted,
          payload: { instanceRecord: inst, state: inst.state, section: inst.section },
        })
      } catch {}
      await this.sendCompleteMessage(agentContext, inst)
    }
    return inst
  }

  public async status(
    agentContext: AgentContext,
    opts: { instance_id: string; include_actions?: boolean; include_ui?: boolean }
  ): Promise<{
    instance_id: string
    state: string
    section?: string
    allowed_events: string[]
    action_menu: Array<{ label?: string; event: string }>
    artifacts: Record<string, unknown>
    ui?: any[]
  }> {
    let inst: WorkflowInstanceRecord
    try {
      inst = await this.instanceRepo.getById(agentContext, opts.instance_id)
    } catch {
      const found = await this.instanceRepo.getByInstanceId(agentContext, opts.instance_id)
      if (!found) throw this.problem('invalid_event', 'instance not found')
      inst = found
    }
    const tplRec = await this.templateRepo.findByTemplateIdAndVersion(
      agentContext,
      inst.templateId,
      inst.templateVersion
    )
    if (!tplRec) throw this.problem('invalid_template', 'template not found for instance')
    const tpl = tplRec.template
    const env = GuardEvaluator.envFromInstance(this.toInstanceData(inst))
    const allowed = transitionsFromState(tpl, inst.state)
      .filter((t) => GuardEvaluator.evalGuard(t.guard, env))
      .map((t) => t.on)
    const includeActions = opts.include_actions ?? true
    const includeUi = opts.include_ui ?? true
    const menu = includeActions
      ? ensureArray(tpl.display_hints?.states?.[inst.state])
          .filter((i) => i?.type === 'button' || i?.type === 'submit-button')
          .map((i) => ({ label: i?.label, event: i?.event }))
      : []
    const ui = includeUi ? ensureArray(tpl.display_hints?.states?.[inst.state]) : undefined
    return {
      instance_id: inst.instanceId,
      state: inst.state,
      section: inst.section,
      allowed_events: allowed,
      action_menu: menu,
      artifacts: inst.artifacts,
      ...(includeUi ? { ui } : {}),
    }
  }

  public async pause(
    agentContext: AgentContext,
    opts: { instance_id: string; reason?: string }
  ): Promise<WorkflowInstanceRecord> {
    const inst = await this.getInstanceByIdOrTag(agentContext, opts.instance_id)
    const prev = inst.status
    inst.status = 'paused'
    await this.instanceRepo.update(agentContext, inst)
    try {
      this.eventEmitter?.emit(agentContext, {
        type: WorkflowEventTypes.WorkflowInstanceStatusChanged,
        payload: { instanceRecord: inst, previousStatus: prev, newStatus: inst.status, reason: opts.reason },
      })
    } catch {}
    return inst
  }

  public async resume(
    agentContext: AgentContext,
    opts: { instance_id: string; reason?: string }
  ): Promise<WorkflowInstanceRecord> {
    const inst = await this.getInstanceByIdOrTag(agentContext, opts.instance_id)
    const prev = inst.status
    inst.status = 'active'
    await this.instanceRepo.update(agentContext, inst)
    try {
      this.eventEmitter?.emit(agentContext, {
        type: WorkflowEventTypes.WorkflowInstanceStatusChanged,
        payload: { instanceRecord: inst, previousStatus: prev, newStatus: inst.status, reason: opts.reason },
      })
    } catch {}
    return inst
  }

  public async cancel(
    agentContext: AgentContext,
    opts: { instance_id: string; reason?: string }
  ): Promise<WorkflowInstanceRecord> {
    const inst = await this.getInstanceByIdOrTag(agentContext, opts.instance_id)
    const prev = inst.status
    inst.status = 'canceled'
    await this.instanceRepo.update(agentContext, inst)
    try {
      this.eventEmitter?.emit(agentContext, {
        type: WorkflowEventTypes.WorkflowInstanceStatusChanged,
        payload: { instanceRecord: inst, previousStatus: prev, newStatus: inst.status, reason: opts.reason },
      })
    } catch {}
    return inst
  }

  public async complete(
    agentContext: AgentContext,
    opts: { instance_id: string; reason?: string }
  ): Promise<WorkflowInstanceRecord> {
    const inst = await this.getInstanceByIdOrTag(agentContext, opts.instance_id)
    // Only allow completion when FSM is in a final state
    const tplRec = await this.templateRepo.findByTemplateIdAndVersion(
      agentContext,
      inst.templateId,
      inst.templateVersion
    )
    if (!tplRec) throw this.problem('invalid_template', 'template not found for instance')
    const toDef = tplRec.template.states.find((s) => s.name === inst.state)
    if (toDef?.type !== 'final') throw this.problem('forbidden', 'cannot complete: state is not final')
    const prev = inst.status
    inst.status = 'completed'
    await this.instanceRepo.update(agentContext, inst)
    try {
      this.eventEmitter?.emit(agentContext, {
        type: WorkflowEventTypes.WorkflowInstanceStatusChanged,
        payload: { instanceRecord: inst, previousStatus: prev, newStatus: inst.status, reason: opts.reason },
      })
      this.eventEmitter?.emit(agentContext, {
        type: WorkflowEventTypes.WorkflowInstanceCompleted,
        payload: { instanceRecord: inst, state: inst.state, section: inst.section },
      })
    } catch {}
    return inst
  }

  public async autoAdvanceByConnection(agentContext: AgentContext, connectionId: string, event: string) {
    const inst = await this.instanceRepo.findLatestByConnection(agentContext, connectionId)
    if (!inst) return
    try {
      await this.advance(agentContext, {
        instance_id: inst.instanceId,
        event,
        idempotency_key: `auto:${event}:${inst.instanceId}`,
      })
    } catch (e) {
      // swallow, log at debug
      this.agentConfig.logger.debug(`Workflow autoAdvance error: ${(e as Error).message}`)
    }
  }

  private evalMultiplicity(expr: string, context: Record<string, unknown>): string {
    try {
      const env = { context, participants: {}, artifacts: {} }
      const val = GuardEvaluator.evalValue(expr, env)
      return val != null ? String(val) : ''
    } catch {
      return ''
    }
  }

  private toInstanceData(rec: WorkflowInstanceRecord): WorkflowInstanceData {
    return {
      instance_id: rec.instanceId,
      template_id: rec.templateId,
      template_version: rec.templateVersion,
      connection_id: rec.connectionId,
      participants: rec.participants,
      state: rec.state,
      section: rec.section,
      context: rec.context,
      artifacts: rec.artifacts,
      status: rec.status,
      history: rec.history,
      multiplicityKeyValue: rec.multiplicityKeyValue,
      idempotencyKeys: rec.idempotencyKeys,
    }
  }

  private problem(code: string, comment: string) {
    const err = new Error(comment)
    ;(err as any).code = code
    return err
  }

  private async getInstanceByIdOrTag(agentContext: AgentContext, instanceId: string) {
    try {
      return await this.instanceRepo.getById(agentContext, instanceId)
    } catch {
      const found = await this.instanceRepo.getByInstanceId(agentContext, instanceId)
      if (!found) throw this.problem('invalid_event', 'instance not found')
      return found
    }
  }

  private uuid(): string {
    // light uuid
    return `wf_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  }

  private validateTemplate(t: WorkflowTemplate) {
    const fail = (msg: string) => {
      throw this.problem('invalid_template', msg)
    }
    if (!t.template_id || !t.version || !t.title) fail('missing required fields')
    if (!Array.isArray(t.states) || !t.states.length) fail('states required')
    if (!Array.isArray(t.transitions)) fail('transitions required')
    if (!Array.isArray(t.actions)) fail('actions required')
    const stateNames = new Set(t.states.map((s) => s.name))
    if (![...t.states].some((s) => s.type === 'start')) fail('start state required')
    for (const s of t.states) {
      if (s.section && !t.sections?.some((sec) => sec.name === s.section)) fail(`state.section not found: ${s.section}`)
    }
    for (const tr of t.transitions) {
      if (!stateNames.has(tr.from)) fail(`transition.from unknown: ${tr.from}`)
      if (!stateNames.has(tr.to)) fail(`transition.to unknown: ${tr.to}`)
      if (tr.action && !t.actions.some((a) => a.key === tr.action)) fail(`transition.action unknown: ${tr.action}`)
    }
    // profile_ref resolution
    for (const a of t.actions) {
      if ('profile_ref' in a && (a as any).profile_ref) {
        const pr = (a as any).profile_ref as string
        if (pr.startsWith('cp.')) {
          const key = pr.slice(3)
          if (!t.catalog?.credential_profiles || !t.catalog.credential_profiles[key]) fail(`catalog.cp missing: ${key}`)
        } else if (pr.startsWith('pp.')) {
          const key = pr.slice(3)
          if (!t.catalog?.proof_profiles || !t.catalog.proof_profiles[key]) fail(`catalog.pp missing: ${key}`)
        } else fail(`invalid profile_ref: ${pr}`)
      }
    }
  }

  private async sendCompleteMessage(agentContext: AgentContext, inst: WorkflowInstanceRecord) {
    try {
      if (!inst.connectionId) return
      const connectionSvc = agentContext.dependencyManager.resolve(DidCommConnectionService)
      const messageSender = agentContext.dependencyManager.resolve(DidCommMessageSender)
      const connection = await connectionSvc.getById(agentContext, inst.connectionId)
      const msg = new CompleteMessage({
        thid: inst.instanceId,
        body: { instance_id: inst.instanceId, reason: 'state_final' },
      })
      const outbound = new DidCommOutboundMessageContext(msg as any, { agentContext, connection })
      await messageSender.sendMessage(outbound)
    } catch (e) {
      this.agentConfig.logger.debug(`Workflow complete notify error: ${(e as Error).message}`)
    }
  }
}
