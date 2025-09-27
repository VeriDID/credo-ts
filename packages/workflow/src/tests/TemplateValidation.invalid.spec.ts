import { validateTemplateJson, validateTemplateRefs } from '..'

const baseTpl = {
  template_id: 't',
  version: '1.0.0',
  title: 'T',
  instance_policy: { mode: 'multi_per_connection' },
  sections: [{ name: 'Main' }],
  states: [{ name: 's', type: 'start', section: 'Main' }],
  transitions: [],
  catalog: {},
  actions: [],
}

describe('Template invalid cases (schema/refs)', () => {
  test('missing start state (passes JSON schema, fails refs)', () => {
    const bad = { ...baseTpl, states: [{ name: 'x', type: 'normal' }] }
    expect(() => validateTemplateJson(bad)).not.toThrow()
    expect(() => validateTemplateRefs(bad as unknown as import('..').WorkflowTemplate)).toThrow()
  })

  test('unknown state.section', () => {
    const bad = { ...baseTpl, states: [{ name: 's', type: 'start', section: 'Unknown' }] }
    expect(() => validateTemplateRefs(bad as unknown as import('..').WorkflowTemplate)).toThrow()
  })

  test('transition.action unknown', () => {
    const bad = { ...baseTpl, transitions: [{ from: 's', to: 's', on: 'go', action: 'missing' }] }
    expect(() => validateTemplateRefs(bad as unknown as import('..').WorkflowTemplate)).toThrow()
  })

  test('transition.to unknown', () => {
    const bad = {
      ...baseTpl,
      states: [{ name: 's', type: 'start', section: 'Main' }],
      transitions: [{ from: 's', to: 'x', on: 'go' }],
    }
    expect(() => validateTemplateRefs(bad as unknown as import('..').WorkflowTemplate)).toThrow()
  })

  test('profile_ref missing in catalog (cp.)', () => {
    const bad = { ...baseTpl, actions: [{ key: 'a', typeURI: 'x', profile_ref: 'cp.unknown' }] }
    expect(() => validateTemplateRefs(bad as unknown as import('..').WorkflowTemplate)).toThrow()
  })

  test('profile_ref missing in catalog (pp.)', () => {
    const bad = { ...baseTpl, actions: [{ key: 'a', typeURI: 'x', profile_ref: 'pp.unknown' }] }
    expect(() => validateTemplateRefs(bad as unknown as import('..').WorkflowTemplate)).toThrow()
  })
})
