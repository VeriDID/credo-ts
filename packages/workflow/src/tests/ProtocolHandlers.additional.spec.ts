import {
  CancelHandler,
  CompleteHandler,
  PauseHandler,
  PublishTemplateHandler,
  ResumeHandler,
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

const inbound = (message: unknown) => ({ agentContext: makeAgentContext(), connection: { id: 'c1' }, message })

describe('Handlers extra cases', () => {
  test('PublishTemplateHandler sends problem-report on error', async () => {
    const svc = {
      publishTemplate: async () => {
        throw Object.assign(new Error('bad'), { code: 'invalid_template' })
      },
    }
    const handler = new PublishTemplateHandler(svc as unknown as import('..').WorkflowService)
    const msg = { type: 'https://didcomm.org/workflow/1.0/publish-template', body: { template: {} } }
    const ctx = await handler.handle(inbound(msg) as never)
    const code = (ctx as unknown as { message?: { body?: { code?: string } } })?.message?.body?.code
    expect(code).toBe('invalid_template')
  })

  test('CompleteHandler ignores invalid_event (no local instance)', async () => {
    const svc = {
      complete: async () => {
        throw Object.assign(new Error('nope'), { code: 'invalid_event' })
      },
      status: async () => ({}),
    }
    const handler = new CompleteHandler(svc as unknown as import('..').WorkflowService)
    const msg = { body: { instance_id: 'i1' }, threadId: 'i1' }
    const res = await handler.handle(inbound(msg) as never)
    expect(res).toBeUndefined()
  })

  test('Pause/Resume/Cancel ignore invalid_event similarly', async () => {
    const svc = {
      pause: async () => {
        throw Object.assign(new Error('nope'), { code: 'invalid_event' })
      },
      resume: async () => {
        throw Object.assign(new Error('nope'), { code: 'invalid_event' })
      },
      cancel: async () => {
        throw Object.assign(new Error('nope'), { code: 'invalid_event' })
      },
      status: async () => ({}),
    }
    const pause = new PauseHandler(svc as unknown as import('..').WorkflowService)
    const resume = new ResumeHandler(svc as unknown as import('..').WorkflowService)
    const cancel = new CancelHandler(svc as unknown as import('..').WorkflowService)
    expect(await pause.handle(inbound({ body: { instance_id: 'i1' } }) as never)).toBeUndefined()
    expect(await resume.handle(inbound({ body: { instance_id: 'i1' } }) as never)).toBeUndefined()
    expect(await cancel.handle(inbound({ body: { instance_id: 'i1' } }) as never)).toBeUndefined()
  })

  test('StatusHandler forwards include flags', async () => {
    const svc = {
      status: async (
        _ctx: unknown,
        opts: { instance_id: string; include_actions?: boolean; include_ui?: boolean }
      ) => ({
        instance_id: opts.instance_id,
        state: 's',
        allowed_events: [],
        action_menu: [],
        artifacts: {},
        ui: [{}],
      }),
    }
    const handler = new StatusHandler(svc as unknown as import('..').WorkflowService)
    const message = new StatusRequestMessage({ body: { instance_id: 'i1', include_actions: false, include_ui: true } })
    const ctx = await handler.handle(inbound(message) as never)
    const body = (ctx as unknown as { message: { body: Record<string, unknown> } }).message.body as unknown as {
      instance_id: string
      action_menu: unknown[]
      ui?: unknown[]
    }
    expect(body.instance_id).toBe('i1')
    expect(Array.isArray(body.ui)).toBe(true)
    expect(body.action_menu).toEqual([])
  })
})
