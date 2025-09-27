import { StartHandler } from '..'

describe('StartHandler success', () => {
  test('returns StatusMessage on success', async () => {
    const record = { instanceId: 'i1' }
    const svc = {
      start: jest.fn(async () => record),
      status: jest.fn(async () => ({
        instance_id: 'i1',
        state: 's',
        allowed_events: [],
        action_menu: [],
        artifacts: {},
      })),
    }
    const handler = new StartHandler(svc as unknown as import('..').WorkflowService)
    const res = await handler.handle({
      agentContext: {
        dependencyManager: { resolve: (_ctor: unknown) => ({ logger: { info() {}, warn() {}, debug() {} } }) },
      },
      connection: { id: 'c1' },
      message: { body: { template_id: 't' }, id: 'id1' },
    } as never)
    expect((res as unknown as { message?: { type?: string } })?.message?.type).toBe(
      'https://didcomm.org/workflow/1.0/status'
    )
  })
})
