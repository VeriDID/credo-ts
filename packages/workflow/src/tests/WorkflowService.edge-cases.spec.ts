import { WorkflowService, WorkflowTemplateRecord } from '..'

describe('WorkflowService additional coverage', () => {
  const makeSvc = (overrides: any = {}) => {
    const tpl: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection', multiplicity_key: overrides.multiplicity_key },
      states: [
        { name: 'a', type: 'start' },
        { name: 'b', type: 'final' },
      ],
      transitions: [{ from: 'a', to: 'b', on: 'go' }],
      catalog: {},
      actions: [],
    }
    const templateRepo = {
      findByTemplateIdAndVersion: jest.fn(async () => ({ template: tpl }) as WorkflowTemplateRecord),
      update: jest.fn(),
      save: jest.fn(),
    } as any
    const instanceRepo = {
      getById: jest.fn(),
      getByInstanceId: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
      findByTemplateAndConnection: jest.fn(async () => []),
      findByTemplateConnAndMultiplicity: jest.fn(async () => []),
      findLatestByConnection: jest.fn(),
    } as any
    const eventEmitter = { emit: jest.fn() } as any
    const config = {
      guardEngine: overrides.engine || 'jmespath',
      autoReturnExistingOnSingleton: true,
      enableProblemReport: true,
    } as any
    const agentConfig = { logger: { debug: jest.fn(), info() {} } } as any
    const svc = new WorkflowService(templateRepo, instanceRepo, config, agentConfig, eventEmitter)
    return { svc, templateRepo, instanceRepo, eventEmitter, agentConfig }
  }

  test('pause/resume/cancel emit status-changed and update status', async () => {
    const { svc, instanceRepo, eventEmitter } = makeSvc()
    const inst: any = { id: 'i', instanceId: 'i', templateId: 't', templateVersion: '1', status: 'active' }
    instanceRepo.getById.mockResolvedValue(inst)
    await svc.pause({} as any, { instance_id: 'i' })
    expect(inst.status).toBe('paused')
    expect(eventEmitter.emit).toHaveBeenCalled()

    inst.status = 'paused'
    await svc.resume({} as any, { instance_id: 'i' })
    expect(inst.status).toBe('active')

    inst.status = 'active'
    await svc.cancel({} as any, { instance_id: 'i' })
    expect(inst.status).toBe('canceled')
  })

  test('status throws invalid_event when instance not found', async () => {
    const { svc, instanceRepo } = makeSvc()
    instanceRepo.getById.mockRejectedValue(new Error('not found'))
    instanceRepo.getByInstanceId.mockResolvedValue(null)
    await expect(svc.status({} as any, { instance_id: 'missing' })).rejects.toHaveProperty('code', 'invalid_event')
  })

  test('status falls back to getByInstanceId when getById fails', async () => {
    const { svc, instanceRepo } = makeSvc()
    const inst = {
      id: 'i',
      instanceId: 'i',
      templateId: 't',
      templateVersion: '1',
      state: 'a',
      status: 'active',
      participants: {},
      context: {},
      artifacts: {},
      history: [],
    }
    instanceRepo.getById.mockRejectedValue(new Error('nope'))
    instanceRepo.getByInstanceId.mockResolvedValue(inst)
    const r = await svc.status({} as any, { instance_id: 'i' })
    expect(r.instance_id).toBe('i')
  })

  test('autoAdvanceByConnection swallows errors and logs debug', async () => {
    const { svc, instanceRepo, agentConfig } = makeSvc()
    instanceRepo.findLatestByConnection.mockResolvedValue({
      instanceId: 'i',
      templateId: 't',
      templateVersion: '1',
      state: 'a',
      status: 'completed',
    })
    await svc.autoAdvanceByConnection({} as any, 'c1', 'request_received')
    expect(agentConfig.logger.debug).toHaveBeenCalled()
  })

  test('start with invalid JS multiplicity_key results in empty multiplicityKeyValue', async () => {
    const { svc, instanceRepo } = makeSvc({ multiplicity_key: 'context.k', engine: 'js' })
    // Spy on GuardEvaluator.evalValue to throw to hit evalMultiplicity catch
    const Guard = require('..').GuardEvaluator
    jest.spyOn(Guard, 'evalValue').mockImplementation(() => {
      throw new Error('bang')
    })
    let saved: any
    instanceRepo.save.mockImplementation(async (_ctx: any, rec: any) => {
      saved = rec
    })
    await svc.start({} as any, { template_id: 't', connection_id: 'c1', context: {} })
    expect(saved.multiplicityKeyValue).toBe('')
    ;(Guard.evalValue as jest.Mock).mockRestore()
  })

  test('getInstanceByIdOrTag throws invalid_event when neither id nor tag resolves', async () => {
    const { svc, instanceRepo } = makeSvc()
    instanceRepo.getById.mockRejectedValue(new Error('boom'))
    instanceRepo.getByInstanceId.mockResolvedValue(null)
    // access private via any and assert thrown
    await expect((svc as any).getInstanceByIdOrTag({} as any, 'i')).rejects.toHaveProperty('code', 'invalid_event')
  })

  test('getInstanceByIdOrTag returns found on fallback path', async () => {
    const { svc, instanceRepo } = makeSvc()
    const inst = { id: 'i', instanceId: 'i' }
    instanceRepo.getById.mockRejectedValue(new Error('boom'))
    instanceRepo.getByInstanceId.mockResolvedValue(inst)
    const out = await (svc as any).getInstanceByIdOrTag({} as any, 'i')
    expect(out.instanceId).toBe('i')
  })
})
