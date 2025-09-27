import { WorkflowInstanceRepository } from '../src'

describe('WorkflowInstanceRepository filters', () => {
  test('findByTemplateConnAndMultiplicity passes all filters', async () => {
    const repo = new WorkflowInstanceRepository({} as any, { on: () => {} } as any)
    const spy = jest.spyOn(repo as any, 'findByQuery').mockResolvedValue([{ id: 'x' }])
    const out = await repo.findByTemplateConnAndMultiplicity({} as any, 'tpl', 'conn', 'K')
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ templateId: 'tpl', connectionId: 'conn', multiplicityKeyValue: 'K' })
    )
    expect(out[0].id).toBe('x')
  })

  test('getByInstanceId calls findSingleByQuery', async () => {
    const repo = new WorkflowInstanceRepository({} as any, { on: () => {} } as any)
    const spy = jest.spyOn(repo as any, 'findSingleByQuery').mockResolvedValue({ id: 'y' })
    const rec = await repo.getByInstanceId({} as any, 'inst')
    expect(spy).toHaveBeenCalledWith(expect.anything(), { instanceId: 'inst' })
    expect(rec.id).toBe('y')
  })
})
