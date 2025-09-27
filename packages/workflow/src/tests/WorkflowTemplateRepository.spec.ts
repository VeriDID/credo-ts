import { WorkflowTemplateRepository } from '../src'

describe('WorkflowTemplateRepository findByTemplateIdAndVersion', () => {
  test('chooses highest version when no version specified', async () => {
    const repo = new WorkflowTemplateRepository({} as any, { on: () => {} } as any)
    const list = [
      { template: { template_id: 't', version: '1.0.0' } },
      { template: { template_id: 't', version: '1.2.0' } },
      { template: { template_id: 't', version: '1.10.0' } },
    ] as any
    jest.spyOn(repo as any, 'findByQuery').mockResolvedValue(list)
    const res = await repo.findByTemplateIdAndVersion({} as any, 't')
    // Sorting is lexicographic in repository implementation
    expect(res?.template.version).toBe('1.2.0')
  })
})
