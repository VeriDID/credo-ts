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
    resolve: (ctor: any) => {
      if (ctor === WorkflowModuleConfig) return new WorkflowModuleConfig({ enableProblemReport: true })
      if (ctor?.name?.includes('AgentConfig')) return { logger: { info() {}, warn() {}, debug() {} } }
      return {}
    },
  },
})

const makeInbound = (message: any) =>
  ({
    agentContext: makeAgentContext(),
    connection: { id: 'conn1' },
    message,
  }) as any

describe('Handlers problem-report mapping', () => {
  test('StartHandler sends problem-report on error', async () => {
    const svc = {
      start: async () => {
        throw Object.assign(new Error('boom'), { code: 'guard_failed' })
      },
      status: async () => ({}),
    }
    const handler = new StartHandler(svc as any)
    const message = new StartMessage({ body: { template_id: 'x' } })
    const res = await handler.handle(makeInbound(message))
    expect((res as any)?.message?.body?.code).toBe('guard_failed')
  })

  test('AdvanceHandler sends problem-report on error', async () => {
    const svc = {
      advance: async () => {
        throw Object.assign(new Error('bad'), { code: 'invalid_event' })
      },
      status: async () => ({}),
    }
    const handler = new AdvanceHandler(svc as any)
    const message = new AdvanceMessage({ body: { instance_id: 'i1', event: 'e' } })
    const res = await handler.handle(makeInbound(message))
    expect((res as any)?.message?.body?.code).toBe('invalid_event')
  })

  test('StatusHandler sends problem-report on error', async () => {
    const svc = {
      status: async () => {
        throw Object.assign(new Error('nope'), { code: 'forbidden' })
      },
    }
    const handler = new StatusHandler(svc as any)
    const message = new StatusRequestMessage({ body: { instance_id: 'i1' } })
    const res = await handler.handle(makeInbound(message))
    expect((res as any)?.message?.body?.code).toBe('forbidden')
  })
})
