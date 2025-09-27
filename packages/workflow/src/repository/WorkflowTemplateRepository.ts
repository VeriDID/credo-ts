import {
  AgentContext,
  EventEmitter,
  InjectionSymbols,
  Repository,
  StorageService,
  inject,
  injectable,
} from '@credo-ts/core'
import { WorkflowTemplateRecord } from './WorkflowTemplateRecord'

@injectable()
export class WorkflowTemplateRepository extends Repository<WorkflowTemplateRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<WorkflowTemplateRecord>,
    eventEmitter: EventEmitter
  ) {
    super(WorkflowTemplateRecord, storageService, eventEmitter)
  }

  public async findByTemplateIdAndVersion(agentContext: AgentContext, templateId: string, version?: string) {
    const list = await this.findByQuery(agentContext, { templateId, ...(version ? { version } : {}) })
    if (!list?.length) return null
    if (version) return list[0]
    // choose highest semver-like lexicographically if multiple
    return list.sort((a, b) => (b.template.version || '').localeCompare(a.template.version || ''))[0]
  }
}
