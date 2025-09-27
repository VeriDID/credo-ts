import type { AgentContext, EventEmitter, StorageService } from '@credo-ts/core'
import { WorkflowInstanceRepository } from '..'
import type { WorkflowInstanceRecord } from '../repository/WorkflowInstanceRecord'

describe('WorkflowInstanceRepository helpers', () => {
  test('findLatestByConnection returns most recent by updatedAt/createdAt', async () => {
    const repo = new WorkflowInstanceRepository(
      {} as unknown as StorageService<WorkflowInstanceRecord>,
      { on: () => {} } as unknown as EventEmitter
    )
    const list: Array<{ id: string; updatedAt?: Date; createdAt?: Date }> = [
      { id: 'a', updatedAt: new Date('2020-01-01'), createdAt: new Date('2020-01-01') },
      { id: 'b', updatedAt: new Date('2021-01-01'), createdAt: new Date('2020-06-01') },
      { id: 'c', createdAt: new Date('2022-01-01') },
    ]
    jest
      .spyOn(
        repo as unknown as { findByConnection: (ctx: AgentContext, id: string) => Promise<typeof list> },
        'findByConnection'
      )
      .mockResolvedValue(list)
    const latest = await repo.findLatestByConnection({} as unknown as AgentContext, 'c1')
    expect(latest?.id).toBe('c')
  })
})
