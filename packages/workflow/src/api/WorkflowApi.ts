import { AgentContext, injectable } from '@credo-ts/core'
import type { Participants, WorkflowTemplate } from '../model/types'
import { WorkflowInstanceRecord } from '../repository/WorkflowInstanceRecord'
import { WorkflowTemplateRecord } from '../repository/WorkflowTemplateRecord'
import { WorkflowService } from '../services/WorkflowService'

@injectable()
export class WorkflowApi {
  public constructor(
    private readonly service: WorkflowService,
    private readonly agentContext: AgentContext
  ) {}

  public publishTemplate(template: WorkflowTemplate): Promise<WorkflowTemplateRecord> {
    return this.service.publishTemplate(this.agentContext, template)
  }

  public start(opts: {
    template_id: string
    template_version?: string
    instance_id?: string
    connection_id?: string
    participants?: Participants
    context?: Record<string, unknown>
  }): Promise<WorkflowInstanceRecord> {
    return this.service.start(this.agentContext, opts)
  }

  public advance(opts: {
    instance_id: string
    event: string
    idempotency_key?: string
    input?: Record<string, unknown>
  }): Promise<WorkflowInstanceRecord> {
    return this.service.advance(this.agentContext, opts)
  }

  public status(opts: { instance_id: string; include_actions?: boolean; include_ui?: boolean }): Promise<{
    instance_id: string
    state: string
    section?: string
    allowed_events: string[]
    action_menu: Array<{ label?: string; event: string }>
    artifacts: Record<string, unknown>
    ui?: import('../model/types').UiItem[]
  }> {
    return this.service.status(this.agentContext, opts)
  }

  public pause(opts: { instance_id: string; reason?: string }) {
    return this.service.pause(this.agentContext, opts)
  }

  public resume(opts: { instance_id: string; reason?: string }) {
    return this.service.resume(this.agentContext, opts)
  }

  public cancel(opts: { instance_id: string; reason?: string }) {
    return this.service.cancel(this.agentContext, opts)
  }

  public complete(opts: { instance_id: string; reason?: string }) {
    return this.service.complete(this.agentContext, opts)
  }
}
