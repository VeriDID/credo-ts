import { validateTemplateJson } from '..'

describe('schemas.ts more invalids', () => {
  test('transitions missing from', () => {
    const bad: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 'a', type: 'start' }],
      transitions: [{ to: 'a', on: 'go' }],
      catalog: {},
      actions: [],
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })

  test('transitions missing to', () => {
    const bad: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 'a', type: 'start' }],
      transitions: [{ from: 'a', on: 'go' }],
      catalog: {},
      actions: [],
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })

  test('states item missing name', () => {
    const bad: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ type: 'start' }],
      transitions: [],
      catalog: {},
      actions: [],
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })

  test('proof requested_predicates item missing p_value', () => {
    const bad: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 'a', type: 'start' }],
      transitions: [],
      catalog: {
        proof_profiles: {
          p: { requested_attributes: [], requested_predicates: [{ name: 'age', p_type: '>=' }], to_ref: 'holder' },
        },
      },
      actions: [],
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })
})
