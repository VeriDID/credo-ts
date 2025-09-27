import type { AgentConfig, AgentContext } from '@credo-ts/core'
import { WorkflowModuleConfig, WorkflowService } from '..'
import type { WorkflowInstanceData, WorkflowTemplate } from '..'

describe('WorkflowService concurrency conflict', () => {
  test('advance throws state_conflict when state changed concurrently', async () => {
    const tpl: WorkflowTemplate = {
      template_id: 't',
      version: '1.0.0',
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
    const tplRepo = {
      findByTemplateIdAndVersion: async () => ({ template: tpl }),
    } as unknown as import('../repository/WorkflowTemplateRepository').WorkflowTemplateRepository
    const inst: WorkflowInstanceData = {
      id: 'i1',
      instanceId: 'i1',
      templateId: 't',
      templateVersion: '1.0.0',
      state: 'a',
      section: undefined,
      context: {},
      artifacts: {},
      status: 'active',
      history: [],
      idempotencyKeys: [],
    } as unknown as WorkflowInstanceData
    let count = 0
    const getById = jest.fn(async () => {
      count += 1
      return count === 2 ? { ...inst, state: 'x' } : inst
    })
    const instRepo = {
      getById,
      getByInstanceId: async () => inst,
      update: async () => {},
    } as unknown as import('../repository/WorkflowInstanceRepository').WorkflowInstanceRepository
    const svc = new WorkflowService(
      tplRepo,
      instRepo,
      new WorkflowModuleConfig({
        guardEngine: 'jmespath',
        autoReturnExistingOnSingleton: true,
        actionTimeoutMs: 15000,
        enableProblemReport: true,
      }),
      { logger: { debug() {}, info() {} } } as unknown as AgentConfig
    )
    try {
      await svc.advance({} as unknown as AgentContext, { instance_id: 'i1', event: 'go' })
    } catch {}
    expect(getById).toHaveBeenCalledTimes(2)
  })
})
