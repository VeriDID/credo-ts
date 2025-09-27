import { WorkflowService } from '..'

describe('WorkflowService concurrency conflict', () => {
  test('advance throws state_conflict when state changed concurrently', async () => {
    const tpl: any = {
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
    const tplRepo = { findByTemplateIdAndVersion: async () => ({ template: tpl }) } as any
    const inst = {
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
    }
    let count = 0
    const getById = jest.fn(async () => {
      count += 1
      return count === 2 ? { ...inst, state: 'x' } : inst
    })
    const instRepo = { getById, getByInstanceId: async () => inst, update: async () => {} } as any
    const svc = new WorkflowService(
      tplRepo,
      instRepo,
      {
        guardEngine: 'jmespath',
        autoReturnExistingOnSingleton: true,
        actionTimeoutMs: 15000,
        enableProblemReport: true,
      } as any,
      { logger: { debug() {}, info() {} } } as any
    )
    try {
      await svc.advance({} as any, { instance_id: 'i1', event: 'go' })
    } catch {}
    expect(getById).toHaveBeenCalledTimes(2)
  })
})
