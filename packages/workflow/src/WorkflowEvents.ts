import type { BaseEvent } from '@credo-ts/core'
import type { WorkflowInstanceRecord, WorkflowInstanceStatus } from './repository/WorkflowInstanceRecord'

export enum WorkflowEventTypes {
  WorkflowInstanceStateChanged = 'WorkflowInstanceStateChanged',
  WorkflowInstanceStatusChanged = 'WorkflowInstanceStatusChanged',
  WorkflowInstanceCompleted = 'WorkflowInstanceCompleted',
}

export interface WorkflowInstanceStateChangedEvent extends BaseEvent {
  type: WorkflowEventTypes.WorkflowInstanceStateChanged
  payload: {
    instanceRecord: WorkflowInstanceRecord
    previousState: string | null
    newState: string
    event: string
    actionKey?: string
    msgId?: string
  }
}

export interface WorkflowInstanceStatusChangedEvent extends BaseEvent {
  type: WorkflowEventTypes.WorkflowInstanceStatusChanged
  payload: {
    instanceRecord: WorkflowInstanceRecord
    previousStatus: WorkflowInstanceStatus | null
    newStatus: WorkflowInstanceStatus
    reason?: string
  }
}

export interface WorkflowInstanceCompletedEvent extends BaseEvent {
  type: WorkflowEventTypes.WorkflowInstanceCompleted
  payload: {
    instanceRecord: WorkflowInstanceRecord
    state: string
    section?: string
  }
}
