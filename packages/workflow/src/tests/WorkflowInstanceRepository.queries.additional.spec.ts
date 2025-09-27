import type { AgentContext, EventEmitter, StorageService } from '@credo-ts/core'
import { WorkflowInstanceRepository } from '..'
import type { WorkflowInstanceRecord } from '../repository/WorkflowInstanceRecord'

describe('WorkflowInstanceRepository filters', () => {
  test('findByTemplateConnAndMultiplicity passes all filters', async () => {
    const repo = new WorkflowInstanceRepository(
      {} as unknown as StorageService<WorkflowInstanceRecord>,
      { on: () => {} } as unknown as EventEmitter
    )
    const spy = jest
      .spyOn(
        repo as unknown as {
          findByQuery: (ctx: AgentContext, q: Record<string, unknown>) => Promise<Array<{ id: string }>>
        },
        'findByQuery'
      )
      .mockResolvedValue([{ id: 'x' }])
    const out = await repo.findByTemplateConnAndMultiplicity({} as unknown as AgentContext, 'tpl', 'conn', 'K')
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ templateId: 'tpl', connectionId: 'conn', multiplicityKeyValue: 'K' })
    )
    expect(out[0].id).toBe('x')
  })

  test('getByInstanceId calls findSingleByQuery', async () => {
    const repo = new WorkflowInstanceRepository(
      {} as unknown as StorageService<WorkflowInstanceRecord>,
      { on: () => {} } as unknown as EventEmitter
    )
    const spy = jest
      .spyOn(
        repo as unknown as {
          findSingleByQuery: (ctx: AgentContext, q: Record<string, unknown>) => Promise<{ id: string }>
        },
        'findSingleByQuery'
      )
      .mockResolvedValue({ id: 'y' })
    const rec = await repo.getByInstanceId({} as unknown as AgentContext, 'inst')
    expect(spy).toHaveBeenCalledWith(expect.anything(), { instanceId: 'inst' })
    expect((rec as unknown as { id: string }).id).toBe('y')
  })
})
