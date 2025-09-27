import {
  CancelHandler,
  CompleteHandler,
  PauseHandler,
  PublishTemplateHandler,
  ResumeHandler,
  StatusHandler,
  StatusRequestMessage,
  WorkflowModuleConfig,
} from '../src'

const makeAgentContext = () => ({
  dependencyManager: {
    resolve: (ctor: any) => {
      if (ctor === WorkflowModuleConfig) return new WorkflowModuleConfig({ enableProblemReport: true })
      if (ctor?.name?.includes('AgentConfig')) return { logger: { info() {}, warn() {}, debug() {} } }
      return {}
    },
  },
})

const inbound = (message: any) => ({ agentContext: makeAgentContext(), connection: { id: 'c1' }, message }) as any

describe('Handlers extra cases', () => {
  test('PublishTemplateHandler sends problem-report on error', async () => {
    const svc = {
      publishTemplate: async () => {
        throw Object.assign(new Error('bad'), { code: 'invalid_template' })
      },
    }
    const handler = new PublishTemplateHandler(svc as any)
    const msg: any = { type: 'https://didcomm.org/workflow/1.0/publish-template', body: { template: {} } }
    const ctx = await handler.handle(inbound(msg))
    expect((ctx as any)?.message?.body?.code).toBe('invalid_template')
  })

  test('CompleteHandler ignores invalid_event (no local instance)', async () => {
    const svc = {
      complete: async () => {
        throw Object.assign(new Error('nope'), { code: 'invalid_event' })
      },
      status: async () => ({}),
    }
    const handler = new CompleteHandler(svc as any)
    const msg: any = { body: { instance_id: 'i1' }, threadId: 'i1' }
    const res = await handler.handle(inbound(msg))
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
    const pause = new PauseHandler(svc as any)
    const resume = new ResumeHandler(svc as any)
    const cancel = new CancelHandler(svc as any)
    expect(await pause.handle(inbound({ body: { instance_id: 'i1' } }))).toBeUndefined()
    expect(await resume.handle(inbound({ body: { instance_id: 'i1' } }))).toBeUndefined()
    expect(await cancel.handle(inbound({ body: { instance_id: 'i1' } }))).toBeUndefined()
  })

  test('StatusHandler forwards include flags', async () => {
    const svc = {
      status: async (_ctx: any, opts: any) => ({
        instance_id: opts.instance_id,
        state: 's',
        allowed_events: [],
        action_menu: [],
        artifacts: {},
        ui: [{}],
      }),
    }
    const handler = new StatusHandler(svc as any)
    const message = new StatusRequestMessage({ body: { instance_id: 'i1', include_actions: false, include_ui: true } })
    const ctx = await handler.handle(inbound(message))
    const body = (ctx as any).message.body
    expect(body.instance_id).toBe('i1')
    expect(Array.isArray(body.ui)).toBe(true)
    expect(body.action_menu).toEqual([])
  })
})
