import { WorkflowService } from '..'

const makeSvc = (inst: any) => {
  const tpl: any = {
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
  const templateRepo = { findByTemplateIdAndVersion: async () => ({ template: tpl }) } as any
  const instanceRepo = {
    getById: async () => inst,
    getByInstanceId: async () => inst,
    update: async () => {},
  } as any
  const config = {
    guardEngine: 'jmespath',
    autoReturnExistingOnSingleton: true,
    actionTimeoutMs: 15000,
    enableProblemReport: true,
  } as any
  const agentConfig = { logger: { debug() {}, info() {} } } as any
  const svc = new WorkflowService(templateRepo, instanceRepo, config, agentConfig)
  return { svc }
}

describe('WorkflowService lifecycle gating', () => {
  test('advance forbidden when paused/canceled/completed', async () => {
    for (const status of ['paused', 'canceled'] as const) {
      const inst = { id: 'i', instanceId: 'i', templateId: 't', templateVersion: '1', state: 'a', status }
      const { svc } = makeSvc(inst)
      await expect(svc.advance({} as any, { instance_id: 'i', event: 'go' })).rejects.toHaveProperty(
        'code',
        'forbidden'
      )
    }
    // completed → invalid_event
    const inst = { id: 'i', instanceId: 'i', templateId: 't', templateVersion: '1', state: 'a', status: 'completed' }
    const { svc } = makeSvc(inst)
    await expect(svc.advance({} as any, { instance_id: 'i', event: 'go' })).rejects.toHaveProperty(
      'code',
      'invalid_event'
    )
  })

  test('complete only allowed when state is final', async () => {
    const inst1 = { id: 'i', instanceId: 'i', templateId: 't', templateVersion: '1', state: 'a', status: 'active' }
    const { svc: s1 } = makeSvc(inst1)
    await expect(s1.complete({} as any, { instance_id: 'i' })).rejects.toHaveProperty('code', 'forbidden')

    const inst2 = { id: 'i', instanceId: 'i', templateId: 't', templateVersion: '1', state: 'b', status: 'active' }
    const { svc: s2 } = makeSvc(inst2)
    const out = await s2.complete({} as any, { instance_id: 'i' })
    expect(out.status).toBe('completed')
  })
})
