import { ProblemReportHandler, ProblemReportMessage } from '..'

describe('ProblemReportHandler', () => {
  test('logs and returns undefined', async () => {
    const handler = new ProblemReportHandler()
    const msg = new ProblemReportMessage({ body: { code: 'invalid_event', comment: 'no local instance' }, thid: 't1' })
    const res = await handler.handle({
      agentContext: { dependencyManager: { resolve: (_: any) => ({ logger: { warn() {} } }) } },
      message: msg,
    } as any)
    expect(res).toBeUndefined()
  })
})
