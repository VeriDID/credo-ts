import type { AgentConfig } from '@credo-ts/core'
import { WorkflowModuleConfig, WorkflowService, validateTemplateJson, validateTemplateRefs } from '..'
import type { WorkflowInstanceRepository } from '../repository/WorkflowInstanceRepository'
import type { WorkflowTemplateRepository } from '../repository/WorkflowTemplateRepository'

describe('WorkflowService.validateTemplate (private)', () => {
  const _make = () => {
    const tplRepo = {} as unknown as WorkflowTemplateRepository
    const instRepo = {} as unknown as WorkflowInstanceRepository
    const config = new WorkflowModuleConfig({ guardEngine: 'jmespath', enableProblemReport: true })
    const agentConfig = { logger: { debug() {}, info() {} } } as unknown as AgentConfig
    const svc = new WorkflowService(tplRepo, instRepo, config, agentConfig)
    return svc as unknown as WorkflowService
  }

  test('valid template passes', () => {
    const tpl = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' as const },
      sections: [{ name: 'Main' }],
      states: [{ name: 's', type: 'start' as const, section: 'Main' }],
      transitions: [{ from: 's', to: 's', on: 'x' }],
      catalog: {
        credential_profiles: {
          test: { cred_def_id: 'C', attribute_plan: { name: { source: 'static', value: 'Alice' } }, to_ref: 'holder' },
        },
        proof_profiles: { p: { requested_attributes: ['name'], requested_predicates: [], to_ref: 'holder' } },
      },
      actions: [
        { key: 'a', typeURI: 'https://didcomm.org/issue-credential/2.0/offer-credential', profile_ref: 'cp.test' },
        { key: 'b', typeURI: 'https://didcomm.org/present-proof/2.0/request-presentation', profile_ref: 'pp.p' },
      ],
    }
    expect(() => validateTemplateJson(tpl)).not.toThrow()
    expect(() => validateTemplateRefs(tpl as unknown as import('..').WorkflowTemplate)).not.toThrow()
  })

  test('invalid transitions and actions throw', () => {
    const bad1 = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' as const },
      states: [{ name: 's', type: 'start' as const }],
      transitions: [{ from: 'unknown', to: 's', on: 'x' }],
      catalog: {},
      actions: [],
    }
    expect(() => validateTemplateRefs(bad1 as unknown as import('..').WorkflowTemplate)).toThrow()
    const bad2 = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' as const },
      states: [{ name: 's', type: 'start' as const }],
      transitions: [{ from: 's', to: 's', on: 'x', action: 'missing' }],
      catalog: {},
      actions: [],
    }
    expect(() => validateTemplateRefs(bad2 as unknown as import('..').WorkflowTemplate)).toThrow()
    const bad3 = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' as const },
      states: [{ name: 's', type: 'start' as const }],
      transitions: [],
      catalog: {},
      actions: [{ key: 'a', typeURI: 'x', profile_ref: 'zz.test' }],
    }
    expect(() => validateTemplateRefs(bad3 as unknown as import('..').WorkflowTemplate)).toThrow()
  })

  test('validateTemplateJson rejects actions missing key', () => {
    const bad = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' as const },
      states: [{ name: 's', type: 'start' as const }],
      transitions: [],
      catalog: {},
      actions: [{ typeURI: 'x' }],
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })
})
