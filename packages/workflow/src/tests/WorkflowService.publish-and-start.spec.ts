import type { AgentConfig, AgentContext } from '@credo-ts/core'
import { WorkflowInstanceRecord, WorkflowModuleConfig, WorkflowService, WorkflowTemplateRecord } from '..'
import type { WorkflowTemplate } from '..'
import type { WorkflowTemplateRepository } from '../repository/WorkflowTemplateRepository'

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
      } as unknown as WorkflowTemplate,
    })
    const templateRepo = {
      findByTemplateIdAndVersion: jest.fn(async () => existing),
      update: jest.fn(async () => {}),
      save: jest.fn(async () => {}),
    } as unknown as WorkflowTemplateRepository
    const instanceRepo = {} as unknown as import('../repository/WorkflowInstanceRepository').WorkflowInstanceRepository
    const svc = new WorkflowService(templateRepo, instanceRepo, new WorkflowModuleConfig({ guardEngine: 'jmespath' }), {
      logger: { info() {}, debug() {} },
    } as unknown as AgentConfig)
    const nextTpl: WorkflowTemplate = {
      template_id: 't',
      version: '1',
      title: 'New',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 'a', type: 'start' }],
      transitions: [],
      catalog: {},
      actions: [],
    }
    const rec = await svc.publishTemplate({} as unknown as AgentContext, nextTpl)
    expect(templateRepo.update).toHaveBeenCalled()
    expect(rec.template.title).toBe('New')
    expect(rec.hash).toBeDefined()
  })

  test('start singleton_per_connection without autoReturnExistingOnSingleton throws already_exists', async () => {
    const tpl: WorkflowTemplate = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'singleton_per_connection' },
      states: [{ name: 's', type: 'start' }],
      transitions: [],
      catalog: {},
      actions: [],
    }
    const templateRepo = {
      findByTemplateIdAndVersion: jest.fn(async () => ({ template: tpl }) as unknown as WorkflowTemplateRecord),
    } as unknown as WorkflowTemplateRepository
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
    const instanceRepo = {
      findByTemplateAndConnection: jest.fn(async () => [existing]),
    } as unknown as import('../repository/WorkflowInstanceRepository').WorkflowInstanceRepository
    const svc = new WorkflowService(
      templateRepo,
      instanceRepo,
      new WorkflowModuleConfig({ guardEngine: 'jmespath', autoReturnExistingOnSingleton: false }),
      { logger: { info() {}, debug() {} } } as unknown as AgentConfig
    )
    await expect(
      svc.start({} as unknown as AgentContext, { template_id: 't', connection_id: 'c1' })
    ).rejects.toHaveProperty('code', 'already_exists')
  })
})
