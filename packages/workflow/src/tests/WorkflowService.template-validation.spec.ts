import { WorkflowService, validateTemplateJson } from '..'

describe('WorkflowService.validateTemplate (private)', () => {
  const make = () => {
    const tplRepo = {} as any
    const instRepo = {} as any
    const config = { guardEngine: 'jmespath', enableProblemReport: true } as any
    const agentConfig = { logger: { debug() {}, info() {} } } as any
    const svc = new WorkflowService(tplRepo, instRepo, config, agentConfig)
    return svc as any
  }

  test('valid template passes', () => {
    const svc = make()
    const tpl = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      sections: [{ name: 'Main' }],
      states: [{ name: 's', type: 'start', section: 'Main' }],
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
    expect(() => svc.validateTemplate(tpl)).not.toThrow()
  })

  test('invalid transitions and actions throw', () => {
    const svc = make()
    const bad1 = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 's', type: 'start' }],
      transitions: [{ from: 'unknown', to: 's', on: 'x' }],
      catalog: {},
      actions: [],
    }
    expect(() => svc.validateTemplate(bad1)).toThrow()
    const bad2 = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 's', type: 'start' }],
      transitions: [{ from: 's', to: 's', on: 'x', action: 'missing' }],
      catalog: {},
      actions: [],
    }
    expect(() => svc.validateTemplate(bad2)).toThrow()
    const bad3 = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 's', type: 'start' }],
      transitions: [],
      catalog: {},
      actions: [{ key: 'a', typeURI: 'x', profile_ref: 'zz.test' }],
    }
    expect(() => svc.validateTemplate(bad3)).toThrow()
  })

  test('validateTemplateJson rejects actions missing key', () => {
    const bad: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 's', type: 'start' }],
      transitions: [],
      catalog: {},
      actions: [{ typeURI: 'x' }],
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })
})
