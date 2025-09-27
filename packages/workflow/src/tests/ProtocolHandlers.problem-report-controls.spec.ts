import { CancelHandler, CompleteHandler, PauseHandler, ResumeHandler, WorkflowModuleConfig } from '..'

const makeCtx = () => ({
  dependencyManager: {
    resolve: (ctor: any) => {
      if (ctor === WorkflowModuleConfig) return new WorkflowModuleConfig({ enableProblemReport: true })
      if (ctor?.name?.includes('AgentConfig')) return { logger: { info() {}, warn() {}, debug() {} } }
      return {}
    },
  },
})

const inbound = (message: any) => ({ agentContext: makeCtx(), connection: { id: 'c1' }, message }) as any

describe('Handlers problem-report (non-invalid_event)', () => {
  test('Cancel/Pause/Resume/Complete return problem-report on error code', async () => {
    const svc = {
      cancel: async () => {
        throw Object.assign(new Error('nope'), { code: 'forbidden' })
      },
      pause: async () => {
        throw Object.assign(new Error('nope'), { code: 'action_error' })
      },
      resume: async () => {
        throw Object.assign(new Error('nope'), { code: 'guard_failed' })
      },
      complete: async () => {
        throw Object.assign(new Error('nope'), { code: 'invalid_template' })
      },
      status: async () => ({}),
    }
    const cancel = new CancelHandler(svc as any)
    const pause = new PauseHandler(svc as any)
    const resume = new ResumeHandler(svc as any)
    const complete = new CompleteHandler(svc as any)
    for (const h of [cancel, pause, resume, complete]) {
      const res = await h.handle(inbound({ body: { instance_id: 'i1' }, threadId: 'i1' }))
      expect((res as any)?.message?.type).toBe('https://didcomm.org/workflow/1.0/problem-report')
    }
  })
})
