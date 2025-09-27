import { WorkflowApi, WorkflowService } from '..'

describe('WorkflowApi pass-through', () => {
  const make = () => {
    const service = {
      publishTemplate: jest.fn(async (_ctx: unknown, t: unknown) => ({ id: 'tpl', template: t })),
      start: jest.fn(async (_ctx: unknown, o: { instance_id?: string }) => ({
        id: o.instance_id || 'id1',
        instanceId: 'i1',
      })),
      advance: jest.fn(async (_ctx: unknown, o: { instance_id: string }) => ({ instanceId: o.instance_id })),
      status: jest.fn(async (_ctx: unknown, o: { instance_id: string }) => ({
        instance_id: o.instance_id,
        state: 's',
        allowed_events: [],
        action_menu: [],
        artifacts: {},
      })),
      pause: jest.fn(async (_ctx: unknown, o: { instance_id: string }) => ({ instanceId: o.instance_id })),
      resume: jest.fn(async (_ctx: unknown, o: { instance_id: string }) => ({ instanceId: o.instance_id })),
      cancel: jest.fn(async (_ctx: unknown, o: { instance_id: string }) => ({ instanceId: o.instance_id })),
      complete: jest.fn(async (_ctx: unknown, o: { instance_id: string }) => ({ instanceId: o.instance_id })),
    }
    const agentContext = {} as unknown as import('@credo-ts/core').AgentContext
    const api = new WorkflowApi(service as unknown as WorkflowService, agentContext)
    return { api, service }
  }

  test('publishes template', async () => {
    const { api, service } = make()
    const tpl: import('..').WorkflowTemplate = {
      template_id: 't',
      version: '1.0.0',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 's', type: 'start' }],
      transitions: [],
      catalog: {},
      actions: [],
    }
    await api.publishTemplate(tpl)
    expect(service.publishTemplate).toHaveBeenCalled()
  })

  test('start/advance/status pipelines through', async () => {
    const { api, service } = make()
    await api.start({ template_id: 't', connection_id: 'c1' })
    expect(service.start).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ template_id: 't', connection_id: 'c1' })
    )
    await api.advance({ instance_id: 'i1', event: 'go' })
    expect(service.advance).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ instance_id: 'i1', event: 'go' })
    )
    await api.status({ instance_id: 'i1', include_actions: false, include_ui: true })
    expect(service.status).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ instance_id: 'i1', include_actions: false, include_ui: true })
    )
  })

  test('pause/resume/cancel/complete', async () => {
    const { api, service } = make()
    await api.pause({ instance_id: 'i1' })
    await api.resume({ instance_id: 'i1' })
    await api.cancel({ instance_id: 'i1' })
    await api.complete({ instance_id: 'i1' })
    expect(service.pause).toHaveBeenCalled()
    expect(service.resume).toHaveBeenCalled()
    expect(service.cancel).toHaveBeenCalled()
    expect(service.complete).toHaveBeenCalled()
  })
})
