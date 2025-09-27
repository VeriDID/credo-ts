import { PublishTemplateHandler } from '../src'

describe('PublishTemplateHandler success', () => {
  test('returns undefined on success (no outbound message)', async () => {
    const svc = { publishTemplate: jest.fn(async () => {}) }
    const handler = new PublishTemplateHandler(svc as any)
    const msg: any = {
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
        dependencyManager: { resolve: (_ctor: any) => ({ logger: { info() {}, warn() {}, debug() {} } }) },
      },
      message: msg,
    } as any)
    expect(res).toBeUndefined()
  })
})
