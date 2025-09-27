import { WorkflowInstanceRepository } from '../src'

describe('WorkflowInstanceRepository helpers', () => {
  test('findLatestByConnection returns most recent by updatedAt/createdAt', async () => {
    const repo = new WorkflowInstanceRepository({} as any, { on: () => {} } as any)
    const list: any[] = [
      { id: 'a', updatedAt: new Date('2020-01-01'), createdAt: new Date('2020-01-01') },
      { id: 'b', updatedAt: new Date('2021-01-01'), createdAt: new Date('2020-06-01') },
      { id: 'c', createdAt: new Date('2022-01-01') },
    ]
    jest.spyOn(repo as any, 'findByConnection').mockResolvedValue(list)
    const latest = await repo.findLatestByConnection({} as any, 'c1')
    expect(latest?.id).toBe('c')
  })
})
