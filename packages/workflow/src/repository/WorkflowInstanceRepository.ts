import { EventEmitter, InjectionSymbols, Repository, StorageService, inject, injectable } from '@credo-ts/core'
import { WorkflowInstanceRecord } from './WorkflowInstanceRecord'

@injectable()
export class WorkflowInstanceRepository extends Repository<WorkflowInstanceRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<WorkflowInstanceRecord>,
    eventEmitter: EventEmitter
  ) {
    super(WorkflowInstanceRecord, storageService, eventEmitter)
  }

  public async findByTemplateAndConnection(agentContext: any, templateId: string, connectionId?: string) {
    return this.findByQuery(agentContext, { templateId, ...(connectionId ? { connectionId } : {}) })
  }

  public async findByTemplateConnAndMultiplicity(
    agentContext: any,
    templateId: string,
    connectionId: string | undefined,
    multiplicityKeyValue: string
  ) {
    return this.findByQuery(agentContext, {
      templateId,
      ...(connectionId ? { connectionId } : {}),
      multiplicityKeyValue,
    })
  }

  public async findByConnection(agentContext: any, connectionId: string) {
    return this.findByQuery(agentContext, { connectionId })
  }

  public async findLatestByConnection(agentContext: any, connectionId: string) {
    const list = await this.findByConnection(agentContext, connectionId)
    if (!list?.length) return null
    return list.sort(
      (a, b) =>
        (b.updatedAt?.getTime?.() || b.createdAt?.getTime?.() || 0) -
        (a.updatedAt?.getTime?.() || a.createdAt?.getTime?.() || 0)
    )[0]
  }

  public async getByInstanceId(agentContext: any, instanceId: string) {
    return this.findSingleByQuery(agentContext, { instanceId })
  }
}
