export type InstancePolicy = {
  mode: 'singleton_per_connection' | 'multi_per_connection'
  multiplicity_key?: string
}

export type SectionDef = { name: string; order?: number; icon?: string }

export type StateDef = { name: string; type: 'start' | 'normal' | 'final'; section?: string }

export type TransitionDef = {
  from: string
  to: string
  on: string
  guard?: string
  action?: string
}

export type AttributeSpec =
  | { source: 'context'; path: string; required?: boolean }
  | { source: 'static'; value: unknown; required?: boolean }
  | { source: 'compute'; expr: string; required?: boolean }

export type CredentialProfile = {
  cred_def_id: string
  attribute_plan: Record<string, AttributeSpec>
  to_ref: string
  options?: Record<string, unknown>
}

export type ProofProfile = {
  // Either cred_def_id or schema_id may be provided to scope restrictions
  cred_def_id?: string
  schema_id?: string
  requested_attributes?: string[]
  requested_predicates?: Array<{ name: string; p_type: string; p_value: number }>
  to_ref: string
  options?: Record<string, unknown>
}

export type Catalog = {
  credential_profiles?: Record<string, CredentialProfile>
  proof_profiles?: Record<string, ProofProfile>
  defaults?: Record<string, unknown>
}

export type ActionDef =
  | { key: string; typeURI: string; profile_ref: string }
  | { key: string; typeURI: string; staticInput?: any }

export type DisplayHints = {
  states?: Record<string, any[]>
}

export type WorkflowTemplate = {
  template_id: string
  version: string
  title: string
  instance_policy: InstancePolicy
  sections?: SectionDef[]
  states: StateDef[]
  transitions: TransitionDef[]
  catalog: Catalog
  actions: ActionDef[]
  display_hints?: DisplayHints
}

export type Participants = Record<string, { did: string }>

export type InstanceHistoryItem = {
  ts: string
  event: string
  from: string
  to: string
  actionKey?: string
  msg_id?: string
}

export type WorkflowInstanceData = {
  instance_id: string
  template_id: string
  template_version: string
  connection_id?: string
  participants: Participants
  state: string
  section?: string
  context: Record<string, any>
  artifacts: Record<string, any>
  status: 'active' | 'paused' | 'canceled' | 'completed' | 'error'
  history: InstanceHistoryItem[]
  multiplicityKeyValue?: string
  idempotencyKeys?: string[]
}

export const findSectionForState = (tpl: WorkflowTemplate, stateName?: string): string | undefined => {
  if (!stateName) return undefined
  const st = tpl.states.find((s) => s.name === stateName)
  return st?.section
}

export const transitionsFromState = (tpl: WorkflowTemplate, state: string) =>
  tpl.transitions.filter((t) => t.from === state)

export const ensureArray = <T>(arr?: T[]): T[] => (Array.isArray(arr) ? arr : [])
