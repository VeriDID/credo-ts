import {
  AdvanceHandler,
  CancelHandler,
  CompleteHandler,
  PauseHandler,
  ResumeHandler,
  WorkflowModuleConfig,
} from '..'

const ctx = () => ({
  dependencyManager: {
    resolve: (ctor: any) => {
      if (ctor === WorkflowModuleConfig) return new WorkflowModuleConfig({ enableProblemReport: true })
      if (ctor?.name?.includes('AgentConfig')) return { logger: { info() {}, warn() {}, debug() {} } }
      return {}
    },
  },
})

const inbound = (message: any) => ({ agentContext: ctx(), connection: { id: 'c1' }, message }) as any

describe('Handlers success responses', () => {
  test('Pause/Resume/Cancel → StatusMessage response', async () => {
    const status = { instance_id: 'i1', state: 's', allowed_events: [], action_menu: [], artifacts: {} }
    const svc = {
      pause: jest.fn(async () => ({})),
      resume: jest.fn(async () => ({})),
      cancel: jest.fn(async () => ({})),
      status: jest.fn(async () => status),
    }
    const pause = new PauseHandler(svc as any)
    const resume = new ResumeHandler(svc as any)
    const cancel = new CancelHandler(svc as any)
    const resP = await pause.handle(inbound({ body: { instance_id: 'i1' }, threadId: 'i1' }))
    const resR = await resume.handle(inbound({ body: { instance_id: 'i1' }, threadId: 'i1' }))
    const resC = await cancel.handle(inbound({ body: { instance_id: 'i1' }, threadId: 'i1' }))
    for (const res of [resP, resR, resC]) {
      expect((res as any)?.message?.type).toBe('https://didcomm.org/workflow/1.0/status')
    }
  })

  test('CompleteHandler → StatusMessage response', async () => {
    const svc = {
      complete: jest.fn(async () => ({})),
      status: jest.fn(async () => ({
        instance_id: 'i1',
        state: 's',
        allowed_events: [],
        action_menu: [],
        artifacts: {},
      })),
    }
    const h = new CompleteHandler(svc as any)
    const res = await h.handle(inbound({ body: { instance_id: 'i1' }, threadId: 'i1' }))
    expect((res as any)?.message?.type).toBe('https://didcomm.org/workflow/1.0/status')
  })

  test('AdvanceHandler success with mismatched thid vs instance_id logs warn path', async () => {
    const svc = {
      advance: jest.fn(async () => ({})),
      status: jest.fn(async () => ({
        instance_id: 'i1',
        state: 's',
        allowed_events: [],
        action_menu: [],
        artifacts: {},
      })),
    }
    const h = new AdvanceHandler(svc as any)
    const res = await h.handle(inbound({ body: { instance_id: 'i1', event: 'go' }, threadId: 'th-other' }))
    expect((res as any)?.message?.type).toBe('https://didcomm.org/workflow/1.0/status')
  })
})
