import type { AgentConfig, AgentContext } from '@credo-ts/core'
import { WorkflowModuleConfig, WorkflowService } from '..'
import type { WorkflowInstanceData, WorkflowTemplate } from '..'

const makeSvc = (inst: WorkflowInstanceData) => {
  const tpl: WorkflowTemplate = {
    template_id: 't',
    version: '1',
    title: 'T',
    instance_policy: { mode: 'multi_per_connection' },
    states: [
      { name: 'a', type: 'start' },
      { name: 'b', type: 'final' },
    ],
    transitions: [{ from: 'a', to: 'b', on: 'go' }],
    catalog: {},
    actions: [],
  }
  const templateRepo = {
    findByTemplateIdAndVersion: async () => ({ template: tpl }),
  } as unknown as {
    findByTemplateIdAndVersion: (ctx: AgentContext, id: string, v?: string) => Promise<{ template: WorkflowTemplate }>
  }
  const instanceRepo = {
    getById: async () => inst,
    getByInstanceId: async () => inst,
    update: async () => {},
  } as unknown as {
    getById: (ctx: AgentContext, id: string) => Promise<WorkflowInstanceData>
    getByInstanceId: (ctx: AgentContext, id: string) => Promise<WorkflowInstanceData>
    update: (ctx: AgentContext, rec: WorkflowInstanceData) => Promise<void>
  }
  const config = new WorkflowModuleConfig({
    guardEngine: 'jmespath',
    autoReturnExistingOnSingleton: true,
    actionTimeoutMs: 15000,
    enableProblemReport: true,
  })
  const agentConfig = { logger: { debug() {}, info() {} } } as unknown as AgentConfig
  const svc = new WorkflowService(
    templateRepo as unknown as import('../repository/WorkflowTemplateRepository').WorkflowTemplateRepository,
    instanceRepo as unknown as import('../repository/WorkflowInstanceRepository').WorkflowInstanceRepository,
    config,
    agentConfig
  )
  return { svc }
}

describe('WorkflowService lifecycle gating', () => {
  test('advance forbidden when paused/canceled/completed', async () => {
    for (const status of ['paused', 'canceled'] as const) {
      const inst = {
        id: 'i',
        instanceId: 'i',
        templateId: 't',
        templateVersion: '1',
        state: 'a',
        status,
      } as unknown as WorkflowInstanceData
      const { svc } = makeSvc(inst)
      await expect(
        svc.advance({} as unknown as AgentContext, { instance_id: 'i', event: 'go' })
      ).rejects.toHaveProperty('code', 'forbidden')
    }
    // completed → invalid_event
    const inst = {
      id: 'i',
      instanceId: 'i',
      templateId: 't',
      templateVersion: '1',
      state: 'a',
      status: 'completed',
    } as unknown as WorkflowInstanceData
    const { svc } = makeSvc(inst)
    await expect(svc.advance({} as unknown as AgentContext, { instance_id: 'i', event: 'go' })).rejects.toHaveProperty(
      'code',
      'invalid_event'
    )
  })

  test('complete only allowed when state is final', async () => {
    const inst1 = {
      id: 'i',
      instanceId: 'i',
      templateId: 't',
      templateVersion: '1',
      state: 'a',
      status: 'active',
    } as unknown as WorkflowInstanceData
    const { svc: s1 } = makeSvc(inst1)
    await expect(s1.complete({} as unknown as AgentContext, { instance_id: 'i' })).rejects.toHaveProperty(
      'code',
      'forbidden'
    )

    const inst2 = {
      id: 'i',
      instanceId: 'i',
      templateId: 't',
      templateVersion: '1',
      state: 'b',
      status: 'active',
    } as unknown as WorkflowInstanceData
    const { svc: s2 } = makeSvc(inst2)
    const out = await s2.complete({} as unknown as AgentContext, { instance_id: 'i' })
    expect(out.status).toBe('completed')
  })
})
