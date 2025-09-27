import { WorkflowInstanceRecord, WorkflowService, WorkflowTemplateRecord } from '..'

describe('WorkflowService publishTemplate+start edge branches', () => {
  test('publishTemplate updates existing record (hash + template) and returns it', async () => {
    const existing = new WorkflowTemplateRecord({
      template: {
        template_id: 't',
        version: '1',
        title: 'Old',
        instance_policy: { mode: 'multi_per_connection' },
        states: [{ name: 'a', type: 'start' }],
        transitions: [],
        catalog: {},
        actions: [],
      } as any,
    })
    const templateRepo = {
      findByTemplateIdAndVersion: jest.fn(async () => existing),
      update: jest.fn(async () => {}),
      save: jest.fn(async () => {}),
    } as any
    const instanceRepo = {} as any
    const svc = new WorkflowService(
      templateRepo,
      instanceRepo,
      { guardEngine: 'jmespath' } as any,
      { logger: { info() {}, debug() {} } } as any
    )
    const nextTpl: any = {
      template_id: 't',
      version: '1',
      title: 'New',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 'a', type: 'start' }],
      transitions: [],
      catalog: {},
      actions: [],
    }
    const rec = await svc.publishTemplate({} as any, nextTpl)
    expect(templateRepo.update).toHaveBeenCalled()
    expect(rec.template.title).toBe('New')
    expect(rec.hash).toBeDefined()
  })

  test('start singleton_per_connection without autoReturnExistingOnSingleton throws already_exists', async () => {
    const tpl: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'singleton_per_connection' },
      states: [{ name: 's', type: 'start' }],
      transitions: [],
      catalog: {},
      actions: [],
    }
    const templateRepo = { findByTemplateIdAndVersion: jest.fn(async () => ({ template: tpl })) } as any
    const existing = new WorkflowInstanceRecord({
      instanceId: 'i',
      templateId: 't',
      templateVersion: '1',
      participants: {},
      state: 's',
      context: {},
      artifacts: {},
      status: 'active',
      history: [],
    })
    const instanceRepo = { findByTemplateAndConnection: jest.fn(async () => [existing]) } as any
    const svc = new WorkflowService(
      templateRepo,
      instanceRepo,
      { guardEngine: 'jmespath', autoReturnExistingOnSingleton: false } as any,
      { logger: { info() {}, debug() {} } } as any
    )
    await expect(svc.start({} as any, { template_id: 't', connection_id: 'c1' })).rejects.toHaveProperty(
      'code',
      'already_exists'
    )
  })
})
