import type { AgentConfig, AgentContext, EventEmitter } from '@credo-ts/core'
import { WorkflowModuleConfig, WorkflowService, WorkflowTemplateRecord } from '..'
import type { WorkflowTemplate } from '..'
import type { WorkflowInstanceRecord } from '../repository/WorkflowInstanceRecord'
import type { WorkflowTemplateRepository } from '../repository/WorkflowTemplateRepository'

describe('WorkflowService additional coverage', () => {
  const makeSvc = (overrides: { multiplicity_key?: string; engine?: 'jmespath' | 'js' } = {}) => {
    const tpl: WorkflowTemplate = {
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
      findByTemplateIdAndVersion: jest.fn(async () => ({ template: tpl }) as unknown as WorkflowTemplateRecord),
      update: jest.fn(),
      save: jest.fn(),
    } as unknown as WorkflowTemplateRepository
    const getById = jest.fn()
    const getByInstanceId = jest.fn()
    const update = jest.fn()
    const save = jest.fn()
    const findByTemplateAndConnection = jest.fn(async () => [])
    const findByTemplateConnAndMultiplicity = jest.fn(async () => [])
    const findLatestByConnection = jest.fn()
    const instanceRepo = {
      getById,
      getByInstanceId,
      update,
      save,
      findByTemplateAndConnection,
      findByTemplateConnAndMultiplicity,
      findLatestByConnection,
    } as unknown as import('../repository/WorkflowInstanceRepository').WorkflowInstanceRepository
    const eventEmitter = { emit: jest.fn() } as unknown as EventEmitter
    const config = new WorkflowModuleConfig({
      guardEngine: overrides.engine || 'jmespath',
      autoReturnExistingOnSingleton: true,
      enableProblemReport: true,
    })
    const agentConfig = { logger: { debug: jest.fn(), info() {} } } as unknown as AgentConfig
    const svc = new WorkflowService(
      templateRepo,
      instanceRepo as unknown as import('../repository/WorkflowInstanceRepository').WorkflowInstanceRepository,
      config,
      agentConfig,
      eventEmitter
    )
    return {
      svc,
      templateRepo,
      instanceRepo,
      eventEmitter,
      agentConfig,
      getById,
      getByInstanceId,
      findLatestByConnection,
    }
  }

  test('pause/resume/cancel emit status-changed and update status', async () => {
    const { svc, eventEmitter, getById } = makeSvc()
    const inst = { id: 'i', instanceId: 'i', templateId: 't', templateVersion: '1', status: 'active' }
    ;(getById as jest.Mock).mockResolvedValue(inst as unknown as WorkflowInstanceRecord)
    await svc.pause({} as unknown as AgentContext, { instance_id: 'i' })
    expect(inst.status).toBe('paused')
    expect(eventEmitter.emit).toHaveBeenCalled()

    inst.status = 'paused'
    await svc.resume({} as unknown as AgentContext, { instance_id: 'i' })
    expect(inst.status).toBe('active')

    inst.status = 'active'
    await svc.cancel({} as unknown as AgentContext, { instance_id: 'i' })
    expect(inst.status).toBe('canceled')
  })

  test('status throws invalid_event when instance not found', async () => {
    const { svc, getById, getByInstanceId } = makeSvc()
    ;(getById as jest.Mock).mockRejectedValue(new Error('not found'))
    ;(getByInstanceId as jest.Mock).mockResolvedValue(null)
    await expect(svc.status({} as unknown as AgentContext, { instance_id: 'missing' })).rejects.toHaveProperty(
      'code',
      'invalid_event'
    )
  })

  test('status falls back to getByInstanceId when getById fails', async () => {
    const { svc, getById, getByInstanceId } = makeSvc()
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
    ;(getById as jest.Mock).mockRejectedValue(new Error('nope'))
    ;(getByInstanceId as jest.Mock).mockResolvedValue(inst)
    const r = await svc.status({} as unknown as AgentContext, { instance_id: 'i' })
    expect(r.instance_id).toBe('i')
  })

  test('autoAdvanceByConnection swallows errors and logs debug', async () => {
    const { svc, agentConfig, findLatestByConnection } = makeSvc()
    ;(findLatestByConnection as jest.Mock).mockResolvedValue({
      instanceId: 'i',
      templateId: 't',
      templateVersion: '1',
      state: 'a',
      status: 'completed',
    })
    await svc.autoAdvanceByConnection({} as unknown as AgentContext, 'c1', 'request_received')
    expect(agentConfig.logger.debug).toHaveBeenCalled()
  })

  test('start with invalid JS multiplicity_key results in empty multiplicityKeyValue', async () => {
    const { svc, instanceRepo } = makeSvc({ multiplicity_key: 'context.k', engine: 'js' })
    // Spy on GuardEvaluator.evalValue to throw to hit evalMultiplicity catch
    const Guard = require('..').GuardEvaluator
    jest.spyOn(Guard, 'evalValue').mockImplementation(() => {
      throw new Error('bang')
    })
    let saved: unknown
    ;(instanceRepo.save as jest.Mock).mockImplementation(async (_ctx: AgentContext, rec: WorkflowInstanceRecord) => {
      saved = rec
    })
    await svc.start({} as unknown as AgentContext, { template_id: 't', connection_id: 'c1', context: {} })
    expect((saved as { multiplicityKeyValue?: string }).multiplicityKeyValue).toBe('')
    ;(Guard.evalValue as jest.Mock).mockRestore()
  })

  test('getInstanceByIdOrTag throws invalid_event when neither id nor tag resolves', async () => {
    const { svc, getById, getByInstanceId } = makeSvc()
    ;(getById as jest.Mock).mockRejectedValue(new Error('boom'))
    ;(getByInstanceId as jest.Mock).mockResolvedValue(null)
    // access private via any and assert thrown
    await expect(
      (
        svc as unknown as { getInstanceByIdOrTag: (ctx: AgentContext, id: string) => Promise<unknown> }
      ).getInstanceByIdOrTag({} as unknown as AgentContext, 'i')
    ).rejects.toHaveProperty('code', 'invalid_event')
  })

  test('getInstanceByIdOrTag returns found on fallback path', async () => {
    const { svc, getById, getByInstanceId } = makeSvc()
    const inst = { id: 'i', instanceId: 'i' }
    ;(getById as jest.Mock).mockRejectedValue(new Error('boom'))
    ;(getByInstanceId as jest.Mock).mockResolvedValue(inst)
    const out = await (
      svc as unknown as { getInstanceByIdOrTag: (ctx: AgentContext, id: string) => Promise<{ instanceId: string }> }
    ).getInstanceByIdOrTag({} as unknown as AgentContext, 'i')
    expect(out.instanceId).toBe('i')
  })
})
