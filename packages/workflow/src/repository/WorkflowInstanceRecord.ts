import type { TagsBase } from '@credo-ts/core'
import { BaseRecord, utils } from '@credo-ts/core'
import type { InstanceHistoryItem, Participants } from '../model/types'

export type WorkflowInstanceStatus = 'active' | 'paused' | 'canceled' | 'completed' | 'error'

export interface WorkflowInstanceRecordProps {
  id?: string
  createdAt?: Date
  instanceId: string
  templateId: string
  templateVersion: string
  connectionId?: string
  participants: Participants
  state: string
  section?: string
  context: Record<string, unknown>
  artifacts: Record<string, unknown>
  status: WorkflowInstanceStatus
  history: InstanceHistoryItem[]
  multiplicityKeyValue?: string
  idempotencyKeys?: string[]
  idempotency?: Array<{ key: string; event: string; to: string; actionKey?: string }>
  tags?: TagsBase
}

export type DefaultWorkflowInstanceTags = {
  instanceId: string
  templateId: string
  templateVersion: string
  connectionId?: string
  state: string
  multiplicityKeyValue?: string
}

export class WorkflowInstanceRecord
  extends BaseRecord<DefaultWorkflowInstanceTags, TagsBase>
  implements WorkflowInstanceRecordProps
{
  public instanceId!: string
  public templateId!: string
  public templateVersion!: string
  public connectionId?: string
  public participants!: Participants
  public state!: string
  public section?: string
  public context!: Record<string, unknown>
  public artifacts!: Record<string, unknown>
  public status!: WorkflowInstanceStatus
  public history!: InstanceHistoryItem[]
  public multiplicityKeyValue?: string
  public idempotencyKeys?: string[]
  public idempotency?: Array<{ key: string; event: string; to: string; actionKey?: string }>

  public static readonly type = 'WorkflowInstanceRecord'
  public readonly type = WorkflowInstanceRecord.type

  public constructor(props: WorkflowInstanceRecordProps) {
    super()
    if (props) {
      this.id = props.id ?? props.instanceId ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.instanceId = props.instanceId
      this.templateId = props.templateId
      this.templateVersion = props.templateVersion
      this.connectionId = props.connectionId
      this.participants = props.participants
      this.state = props.state
      this.section = props.section
      this.context = props.context ?? {}
      this.artifacts = props.artifacts ?? {}
      this.status = props.status
      this.history = props.history ?? []
      this.multiplicityKeyValue = props.multiplicityKeyValue
      this.idempotencyKeys = props.idempotencyKeys ?? []
      this.idempotency = props.idempotency ?? []
      this._tags = props.tags ?? {}
    }
  }

  public getTags(): DefaultWorkflowInstanceTags {
    return {
      ...this._tags,
      instanceId: this.instanceId,
      templateId: this.templateId,
      templateVersion: this.templateVersion,
      connectionId: this.connectionId,
      state: this.state,
      multiplicityKeyValue: this.multiplicityKeyValue,
    }
  }
}
