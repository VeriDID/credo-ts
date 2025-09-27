import { AdvanceHandler, CancelHandler, CompleteHandler, PauseHandler, ResumeHandler, WorkflowModuleConfig } from '..'

const ctx = () => ({
  dependencyManager: {
    resolve: (ctor: unknown) => {
      if (ctor === WorkflowModuleConfig) return new WorkflowModuleConfig({ enableProblemReport: true })
      return { logger: { info() {}, warn() {}, debug() {} } }
    },
  },
})

const inbound = (message: unknown) => ({ agentContext: ctx(), connection: { id: 'c1' }, message })

describe('Handlers success responses', () => {
  test('Pause/Resume/Cancel → StatusMessage response', async () => {
    const status = { instance_id: 'i1', state: 's', allowed_events: [], action_menu: [], artifacts: {} }
    const svc = {
      pause: jest.fn(async () => ({})),
      resume: jest.fn(async () => ({})),
      cancel: jest.fn(async () => ({})),
      status: jest.fn(async () => status),
    }
    const pause = new PauseHandler(svc as unknown as import('..').WorkflowService)
    const resume = new ResumeHandler(svc as unknown as import('..').WorkflowService)
    const cancel = new CancelHandler(svc as unknown as import('..').WorkflowService)
    const resP = await pause.handle(inbound({ body: { instance_id: 'i1' }, threadId: 'i1' }) as never)
    const resR = await resume.handle(inbound({ body: { instance_id: 'i1' }, threadId: 'i1' }) as never)
    const resC = await cancel.handle(inbound({ body: { instance_id: 'i1' }, threadId: 'i1' }) as never)
    for (const res of [resP, resR, resC]) {
      expect((res as unknown as { message?: { type?: string } })?.message?.type).toBe(
        'https://didcomm.org/workflow/1.0/status'
      )
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
    const h = new CompleteHandler(svc as unknown as import('..').WorkflowService)
    const res = await h.handle(inbound({ body: { instance_id: 'i1' }, threadId: 'i1' }) as never)
    expect((res as unknown as { message?: { type?: string } })?.message?.type).toBe(
      'https://didcomm.org/workflow/1.0/status'
    )
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
    const h = new AdvanceHandler(svc as unknown as import('..').WorkflowService)
    const res = await h.handle(inbound({ body: { instance_id: 'i1', event: 'go' }, threadId: 'th-other' }) as never)
    expect((res as unknown as { message?: { type?: string } })?.message?.type).toBe(
      'https://didcomm.org/workflow/1.0/status'
    )
  })
})
