import type { AgentContext } from '@credo-ts/core'
import { AttributePlanner, deepMerge } from '../engine/AttributePlanner'
import type { ActionDef, WorkflowInstanceData, WorkflowTemplate } from '../model/types'

export type ActionCtx = {
  agentContext: AgentContext
  template: WorkflowTemplate
  instance: WorkflowInstanceData
  action: ActionDef
  input?: Record<string, unknown>
}

export type ActionResult = {
  artifacts?: Record<string, unknown>
  contextMerge?: Record<string, unknown>
  messageId?: string
}

export interface WorkflowActionHandler {
  readonly typeUri: string
  execute(ctx: ActionCtx): Promise<ActionResult>
}

export class ActionRegistry {
  private handlers = new Map<string, WorkflowActionHandler>()
  public register(handler: WorkflowActionHandler) {
    this.handlers.set(handler.typeUri, handler)
  }
  public get(typeUri: string): WorkflowActionHandler | undefined {
    return this.handlers.get(typeUri)
  }
}

export class LocalStateSetAction implements WorkflowActionHandler {
  public readonly typeUri = 'https://didcomm.org/workflow/actions/state:set@1'
  public async execute(ctx: ActionCtx): Promise<ActionResult> {
    const mergeObj = (ctx.action as { staticInput?: unknown })?.staticInput as { merge?: unknown } | undefined | string
    const mergeValue = typeof mergeObj === 'object' && mergeObj ? (mergeObj as { merge?: unknown }).merge : mergeObj
    if (mergeValue && typeof mergeValue === 'object') {
      const next = deepMerge({ ...(ctx.instance.context || {}) }, mergeValue as Record<string, unknown>)
      return { contextMerge: next }
    }
    // if string with template, try basic input resolution: '{{ input.form }}'
    if (typeof mergeValue === 'string' && ctx.input && mergeValue.includes('input.')) {
      try {
        const path = mergeValue
          .replace(/\{\{|\}\}/g, '')
          .trim()
          .replace(/^input\./, '')
        const value = path.split('.').reduce<unknown>((acc, p) => {
          if (acc === null || acc === undefined) return undefined
          if (typeof acc !== 'object') return undefined
          return (acc as Record<string, unknown>)[p]
        }, ctx.input)
        if (value && typeof value === 'object') {
          const next = deepMerge({ ...(ctx.instance.context || {}) }, value as Record<string, unknown>)
          return { contextMerge: next }
        }
      } catch {}
    }
    return {}
  }
}

export class IssueCredentialV2Action implements WorkflowActionHandler {
  public readonly typeUri = 'https://didcomm.org/issue-credential/2.0/offer-credential'
  public async execute(ctx: ActionCtx): Promise<ActionResult> {
    const act = ctx.action as { profile_ref: string }
    const ref: string = act.profile_ref
    if (!ref?.startsWith('cp.')) throw Object.assign(new Error('invalid profile_ref'), { code: 'action_error' })
    const key = ref.slice(3)
    const profile = ctx.template.catalog?.credential_profiles?.[key]
    if (!profile) throw Object.assign(new Error('missing catalog profile'), { code: 'action_error' })
    const attrs = AttributePlanner.materialize(profile.attribute_plan || {}, ctx.instance)
    const attributes = Object.entries(attrs).map(([name, value]) => ({ name, value: String(value) }))
    const connectionId = ctx.instance.connection_id
    if (!connectionId) throw Object.assign(new Error('connectionId required'), { code: 'action_error' })
    // Enforce to_ref recipient DID against connection counterparty DID (if available)
    {
      const toRef = profile.to_ref
      const expectedDid = toRef ? ctx.instance.participants?.[toRef]?.did : undefined
      if (expectedDid && ctx.instance.connection_id) {
        const {
          DidCommConnectionService,
        } = require('@credo-ts/didcomm/src/modules/connections/services/DidCommConnectionService')
        const connSvc = ctx.agentContext.dependencyManager.resolve(DidCommConnectionService) as import(
          '@credo-ts/didcomm'
        ).DidCommConnectionService
        const conn = await connSvc.getById(ctx.agentContext, ctx.instance.connection_id)
        const theirDid = (conn as unknown as { theirDid?: string })?.theirDid
        if (theirDid && theirDid !== expectedDid)
          throw Object.assign(new Error('to_ref DID mismatch'), { code: 'forbidden' })
      }
    }
    try {
      const { DidCommCredentialsApi } = require('@credo-ts/didcomm/src/modules/credentials/DidCommCredentialsApi')
      const credsApi = ctx.agentContext.dependencyManager.resolve(DidCommCredentialsApi) as unknown as {
        offerCredential: (options: unknown) => Promise<{ id: string; credentialRecord?: { id?: string } }>
        findOfferMessage: (id: string) => Promise<import('@credo-ts/didcomm').DidCommMessage | null>
      }
      const record = await credsApi.offerCredential({
        connectionId,
        protocolVersion: 'v2',
        credentialFormats: { anoncreds: { credentialDefinitionId: profile.cred_def_id, attributes } },
        comment: profile.options?.comment,
      })
      let messageId: string | undefined = record?.id || record?.credentialRecord?.id
      try {
        if (messageId) {
          const found = (await credsApi.findOfferMessage(messageId)) as unknown
          if (found && typeof found === 'object') {
            const f = found as { id?: string; message?: { id?: string } }
            messageId = f.message?.id || f.id || messageId
          }
        }
      } catch {}
      return { artifacts: { issueRecordId: record?.id || record?.credentialRecord?.id }, messageId }
    } catch (e) {
      throw Object.assign(new Error(`issue action error: ${(e as Error).message}`), { code: 'action_error' })
    }
  }
}

export class PresentProofV2Action implements WorkflowActionHandler {
  public readonly typeUri = 'https://didcomm.org/present-proof/2.0/request-presentation'
  public async execute(ctx: ActionCtx): Promise<ActionResult> {
    const act = ctx.action as { profile_ref: string }
    const ref: string = act.profile_ref
    if (!ref?.startsWith('pp.')) throw Object.assign(new Error('invalid profile_ref'), { code: 'action_error' })
    const key = ref.slice(3)
    const profile = ctx.template.catalog?.proof_profiles?.[key]
    if (!profile) throw Object.assign(new Error('missing catalog profile'), { code: 'action_error' })
    const connectionId = ctx.instance.connection_id
    if (!connectionId) throw Object.assign(new Error('connectionId required'), { code: 'action_error' })
    // Enforce to_ref recipient DID against connection counterparty DID (if available)
    {
      const toRef2 = profile.to_ref
      const expectedDid2 = toRef2 ? ctx.instance.participants?.[toRef2]?.did : undefined
      if (expectedDid2 && ctx.instance.connection_id) {
        const {
          DidCommConnectionService,
        } = require('@credo-ts/didcomm/src/modules/connections/services/DidCommConnectionService')
        const connSvc = ctx.agentContext.dependencyManager.resolve(DidCommConnectionService) as import(
          '@credo-ts/didcomm'
        ).DidCommConnectionService
        const conn = await connSvc.getById(ctx.agentContext, ctx.instance.connection_id)
        const theirDid = (conn as unknown as { theirDid?: string })?.theirDid
        if (theirDid && theirDid !== expectedDid2)
          throw Object.assign(new Error('to_ref DID mismatch'), { code: 'forbidden' })
      }
    }
    try {
      const { DidCommProofsApi } = require('@credo-ts/didcomm/src/modules/proofs/DidCommProofsApi')
      const proofsApi = ctx.agentContext.dependencyManager.resolve(DidCommProofsApi) as unknown as {
        requestProof: (options: unknown) => Promise<{ id: string; proofRecord?: { id?: string } }>
        findRequestMessage: (id: string) => Promise<import('@credo-ts/didcomm').DidCommMessage | null>
      }
      const credDefId = (profile as { cred_def_id?: string }).cred_def_id
      const schemaId = (profile as { schema_id?: string }).schema_id
      const restriction = credDefId ? { cred_def_id: credDefId } : schemaId ? { schema_id: schemaId } : undefined

      const reqAttrs = (profile.requested_attributes || []).reduce<Record<string, unknown>>(
        (acc, name: string, idx: number) => {
          acc[`attr${idx + 1}`] = restriction ? { name, restrictions: [restriction] } : { name }
          return acc
        },
        {}
      )
      const reqPreds = (profile.requested_predicates || []).reduce<Record<string, unknown>>(
        (acc, p: { name: string; p_type: string; p_value: number }, idx: number) => {
          acc[`pred${idx + 1}`] = restriction
            ? { name: p.name, p_type: p.p_type, p_value: p.p_value, restrictions: [restriction] }
            : { name: p.name, p_type: p.p_type, p_value: p.p_value }
          return acc
        },
        {}
      )
      const record = await proofsApi.requestProof({
        connectionId,
        protocolVersion: 'v2',
        proofFormats: {
          anoncreds: {
            name: 'Workflow Proof Request',
            version: '1.0',
            requested_attributes: reqAttrs,
            requested_predicates: reqPreds,
          },
        },
        willConfirm: true,
        comment: profile.options?.comment,
      })
      let messageId: string | undefined = record?.id || record?.proofRecord?.id
      try {
        if (messageId) {
          const found = (await proofsApi.findRequestMessage(messageId)) as unknown
          if (found && typeof found === 'object') {
            const f = found as { id?: string; message?: { id?: string } }
            messageId = f.message?.id || f.id || messageId
          }
        }
      } catch {}
      return { artifacts: { proofRecordId: record?.id || record?.proofRecord?.id }, messageId }
    } catch (e) {
      throw Object.assign(new Error(`proof action error: ${(e as Error).message}`), { code: 'action_error' })
    }
  }
}
