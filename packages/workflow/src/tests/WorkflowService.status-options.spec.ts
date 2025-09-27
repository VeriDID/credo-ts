import type { AgentConfig, AgentContext } from '@credo-ts/core'
import { WorkflowService } from '..'
import type { WorkflowTemplate } from '..'
import { WorkflowModuleConfig } from '..'
import type { WorkflowInstanceRecord } from '../repository/WorkflowInstanceRecord'
import type { WorkflowTemplateRecord } from '../repository/WorkflowTemplateRecord'
import type { WorkflowTemplateRepository } from '../repository/WorkflowTemplateRepository'

describe('WorkflowService.status include flags', () => {
  const make = () => {
    const tpl: WorkflowTemplate = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 'a', type: 'start' }],
      transitions: [],
      display_hints: {
        states: {
          a: [
            { type: 'text', text: 'Hello' },
            { type: 'button', label: 'Go', event: 'go' },
            { type: 'submit-button', label: 'Send', event: 'send' },
          ],
        },
      },
      catalog: {},
      actions: [],
    }
    const templateRepo = {
      findByTemplateIdAndVersion: jest.fn(async () => ({ template: tpl }) as unknown as WorkflowTemplateRecord),
    } as unknown as WorkflowTemplateRepository
    const inst = {
      id: 'i',
      instanceId: 'i',
      templateId: 't',
      templateVersion: '1',
      state: 'a',
      section: 'S',
      context: {},
      artifacts: {},
      history: [],
      status: 'active',
    } as unknown as WorkflowInstanceRecord
    const instanceRepo = {
      getById: jest.fn(async () => inst),
      update: jest.fn(),
    } as unknown as import('../repository/WorkflowInstanceRepository').WorkflowInstanceRepository
    const config = new WorkflowModuleConfig({ guardEngine: 'jmespath', enableProblemReport: true })
    const agentConfig = { logger: { debug() {}, info() {} } } as unknown as AgentConfig
    const svc = new WorkflowService(templateRepo, instanceRepo, config, agentConfig)
    return { svc }
  }

  test('include_actions=false include_ui=true', async () => {
    const { svc } = make()
    const r = await svc.status({} as unknown as AgentContext, {
      instance_id: 'i',
      include_actions: false,
      include_ui: true,
    })
    expect(r.action_menu).toEqual([])
    expect(Array.isArray(r.ui)).toBe(true)
  })

  test('include_actions=true include_ui=false', async () => {
    const { svc } = make()
    const r = await svc.status({} as unknown as AgentContext, {
      instance_id: 'i',
      include_actions: true,
      include_ui: false,
    })
    expect(r.action_menu.map((i) => i.event)).toEqual(expect.arrayContaining(['go', 'send']))
    expect(r.ui).toBeUndefined()
  })
})
