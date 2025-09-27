import { PublishTemplateHandler } from '..'

describe('PublishTemplateHandler success', () => {
  test('returns undefined on success (no outbound message)', async () => {
    const svc = { publishTemplate: jest.fn(async () => {}) }
    const handler = new PublishTemplateHandler(svc as unknown as import('..').WorkflowService)
    const msg = {
      body: {
        template: {
          template_id: 't',
          version: '1',
          title: 'T',
          instance_policy: { mode: 'multi_per_connection' },
          states: [{ name: 'a', type: 'start' }],
          transitions: [],
          catalog: {},
          actions: [],
        },
      },
    }
    const res = await handler.handle({
      agentContext: {
        dependencyManager: { resolve: (_ctor: unknown) => ({ logger: { info() {}, warn() {}, debug() {} } }) },
      },
      message: msg,
    } as never)
    expect(res).toBeUndefined()
  })
})
