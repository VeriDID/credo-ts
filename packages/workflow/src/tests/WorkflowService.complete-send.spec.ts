import { WorkflowService } from '../src'

const baseTpl: any = {
  template_id: 't',
  version: '1',
  title: 'T',
  instance_policy: { mode: 'multi_per_connection' },
  states: [
    { name: 'a', type: 'start' },
    { name: 'b', type: 'final' },
  ],
  transitions: [{ from: 'a', to: 'b', on: 'go' }],
  catalog: {},
  actions: [],
}

describe('sendCompleteMessage via advance to final', () => {
  test('sends Complete when connectionId present (success path)', async () => {
    const templateRepo = { findByTemplateIdAndVersion: async () => ({ template: baseTpl }) } as any
    let inst: any = {
      id: 'i',
      instanceId: 'i',
      templateId: 't',
      templateVersion: '1',
      state: 'a',
      status: 'active',
      context: {},
      artifacts: {},
      history: [],
      connectionId: 'conn1',
    }
    const instanceRepo = {
      getById: async () => inst,
      getByInstanceId: async () => inst,
      update: async (_ctx: any, rec: any) => {
        inst = rec
      },
    } as any
    const config = { guardEngine: 'jmespath', enableProblemReport: true } as any
    const agentConfig = { logger: { debug: jest.fn(), info() {} } } as any
    const svc = new WorkflowService(templateRepo, instanceRepo, config, agentConfig)

    // agentContext returns connection service + message sender
    const connection = { id: 'conn1' }
    const connectionSvc = { getById: jest.fn(async () => connection) }
    const messageSender = { sendMessage: jest.fn(async () => {}) }
    const agentContext: any = {
      dependencyManager: {
        resolve: (ctor: any) => {
          if ((ctor?.name || '').includes('ConnectionService')) return connectionSvc
          if ((ctor?.name || '').includes('MessageSender')) return messageSender
          return {}
        },
      },
    }

    await svc.advance(agentContext, { instance_id: 'i', event: 'go' })
    expect(messageSender.sendMessage).toHaveBeenCalled()
  })

  test('swallows errors during Complete notify (debug logged)', async () => {
    const templateRepo = { findByTemplateIdAndVersion: async () => ({ template: baseTpl }) } as any
    let inst: any = {
      id: 'i',
      instanceId: 'i',
      templateId: 't',
      templateVersion: '1',
      state: 'a',
      status: 'active',
      context: {},
      artifacts: {},
      history: [],
      connectionId: 'conn1',
    }
    const instanceRepo = {
      getById: async () => inst,
      getByInstanceId: async () => inst,
      update: async (_ctx: any, rec: any) => {
        inst = rec
      },
    } as any
    const config = { guardEngine: 'jmespath', enableProblemReport: true } as any
    const agentConfig = { logger: { debug: jest.fn(), info() {} } } as any
    const svc = new WorkflowService(templateRepo, instanceRepo, config, agentConfig)

    const connectionSvc = {
      getById: jest.fn(async () => {
        throw new Error('nope')
      }),
    }
    const messageSender = { sendMessage: jest.fn(async () => {}) }
    const agentContext: any = {
      dependencyManager: {
        resolve: (ctor: any) => {
          if ((ctor?.name || '').includes('ConnectionService')) return connectionSvc
          if ((ctor?.name || '').includes('MessageSender')) return messageSender
          return {}
        },
      },
    }

    await svc.advance(agentContext, { instance_id: 'i', event: 'go' })
    // error is swallowed and logged at debug
    expect(agentConfig.logger.debug).toHaveBeenCalled()
  })
})
