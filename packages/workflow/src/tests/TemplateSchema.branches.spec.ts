import { validateTemplateJson } from '..'

const base = {
  template_id: 't',
  version: '1',
  title: 'T',
  instance_policy: { mode: 'multi_per_connection' as const },
  states: [{ name: 'a', type: 'start' as const }],
  transitions: [],
  catalog: {},
  actions: [],
}

describe('schemas.ts JSON-schema branches', () => {
  test('root additionalProperties=false', () => {
    const bad = { ...base, foo: 'bar' }
    expect(() => validateTemplateJson(bad)).toThrow()
  })

  test('instance_policy additionalProperties=false', () => {
    const bad = { ...base, instance_policy: { mode: 'multi_per_connection', extra: 1 } }
    expect(() => validateTemplateJson(bad)).toThrow()
  })

  test('transitions item additionalProperties=false', () => {
    const bad = { ...base, transitions: [{ from: 'a', to: 'a', on: 'x', extra: true }] }
    expect(() => validateTemplateJson(bad)).toThrow()
  })

  test('credential_profiles entry additionalProperties=false', () => {
    const bad = {
      ...base,
      catalog: { credential_profiles: { x: { cred_def_id: 'C', attribute_plan: {}, to_ref: 'holder', extra: 'no' } } },
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })

  test('proof_profiles entry additionalProperties=false', () => {
    const bad = {
      ...base,
      catalog: { proof_profiles: { x: { to_ref: 'holder', extra: 'no' } } },
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })

  test('requested_predicates item additionalProperties=false', () => {
    const bad = {
      ...base,
      catalog: {
        proof_profiles: {
          x: { to_ref: 'holder', requested_predicates: [{ name: 'age', p_type: '>=', p_value: 18, foo: 'bar' }] },
        },
      },
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })
})
