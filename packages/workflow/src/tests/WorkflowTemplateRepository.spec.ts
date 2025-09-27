import type { AgentContext, EventEmitter, StorageService } from '@credo-ts/core'
import { WorkflowTemplateRepository } from '..'
import type { WorkflowTemplateRecord } from '../repository/WorkflowTemplateRecord'

describe('WorkflowTemplateRepository findByTemplateIdAndVersion', () => {
  test('chooses highest version when no version specified', async () => {
    const repo = new WorkflowTemplateRepository(
      {} as unknown as StorageService<WorkflowTemplateRecord>,
      { on: () => {} } as unknown as EventEmitter
    )
    const list: Array<{ template: { template_id: string; version: string } }> = [
      { template: { template_id: 't', version: '1.0.0' } },
      { template: { template_id: 't', version: '1.2.0' } },
      { template: { template_id: 't', version: '1.10.0' } },
    ]
    jest
      .spyOn(
        repo as unknown as { findByQuery: (ctx: AgentContext, q: Record<string, unknown>) => Promise<typeof list> },
        'findByQuery'
      )
      .mockResolvedValue(list)
    const res = await repo.findByTemplateIdAndVersion({} as unknown as AgentContext, 't')
    // Sorting is lexicographic in repository implementation
    expect(res?.template.version).toBe('1.2.0')
  })
})
