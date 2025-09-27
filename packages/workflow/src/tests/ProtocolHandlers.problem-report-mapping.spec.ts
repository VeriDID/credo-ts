import {
  AdvanceHandler,
  AdvanceMessage,
  StartHandler,
  StartMessage,
  StatusHandler,
  StatusRequestMessage,
  WorkflowModuleConfig,
} from '..'

const makeAgentContext = () => ({
  dependencyManager: {
    resolve: (ctor: unknown) => {
      if (ctor === WorkflowModuleConfig) return new WorkflowModuleConfig({ enableProblemReport: true })
      return { logger: { info() {}, warn() {}, debug() {} } }
    },
  },
})

const makeInbound = (message: unknown) => ({
  agentContext: makeAgentContext(),
  connection: { id: 'conn1' },
  message,
})

describe('Handlers problem-report mapping', () => {
  test('StartHandler sends problem-report on error', async () => {
    const svc = {
      start: async () => {
        throw Object.assign(new Error('boom'), { code: 'guard_failed' })
      },
      status: async () => ({}),
    }
    const handler = new StartHandler(svc as unknown as import('..').WorkflowService)
    const message = new StartMessage({ body: { template_id: 'x' } })
    const res = await handler.handle(makeInbound(message) as never)
    const code = (res as unknown as { message?: { body?: { code?: string } } })?.message?.body?.code
    expect(code).toBe('guard_failed')
  })

  test('AdvanceHandler sends problem-report on error', async () => {
    const svc = {
      advance: async () => {
        throw Object.assign(new Error('bad'), { code: 'invalid_event' })
      },
      status: async () => ({}),
    }
    const handler = new AdvanceHandler(svc as unknown as import('..').WorkflowService)
    const message = new AdvanceMessage({ body: { instance_id: 'i1', event: 'e' } })
    const res = await handler.handle(makeInbound(message) as never)
    const code2 = (res as unknown as { message?: { body?: { code?: string } } })?.message?.body?.code
    expect(code2).toBe('invalid_event')
  })

  test('StatusHandler sends problem-report on error', async () => {
    const svc = {
      status: async () => {
        throw Object.assign(new Error('nope'), { code: 'forbidden' })
      },
    }
    const handler = new StatusHandler(svc as unknown as import('..').WorkflowService)
    const message = new StatusRequestMessage({ body: { instance_id: 'i1' } })
    const res = await handler.handle(makeInbound(message) as never)
    const code3 = (res as unknown as { message?: { body?: { code?: string } } })?.message?.body?.code
    expect(code3).toBe('forbidden')
  })
})
