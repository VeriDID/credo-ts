import { validateTemplateJson, validateTemplateRefs } from '..'

describe('schemas.ts additional coverage', () => {
  test('transitions missing on', () => {
    const bad: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 'a', type: 'start' }],
      transitions: [{ from: 'a', to: 'a' }],
      catalog: {},
      actions: [],
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })

  test('state missing type', () => {
    const bad: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 'a' }],
      transitions: [],
      catalog: {},
      actions: [],
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })

  test('attribute_plan invalid variants', () => {
    const base: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 'a', type: 'start' }],
      transitions: [],
      catalog: { credential_profiles: {} },
      actions: [],
    }
    // context missing path
    const bad1 = {
      ...base,
      catalog: {
        credential_profiles: {
          x: { cred_def_id: 'C', attribute_plan: { name: { source: 'context' } }, to_ref: 'holder' },
        },
      },
    }
    const bad2 = {
      ...base,
      catalog: {
        credential_profiles: {
          x: { cred_def_id: 'C', attribute_plan: { name: { source: 'static' } }, to_ref: 'holder' },
        },
      },
    }
    const bad3 = {
      ...base,
      catalog: {
        credential_profiles: {
          x: { cred_def_id: 'C', attribute_plan: { name: { source: 'compute' } }, to_ref: 'holder' },
        },
      },
    }
    expect(() => validateTemplateJson(bad1)).toThrow()
    expect(() => validateTemplateJson(bad2)).toThrow()
    expect(() => validateTemplateJson(bad3)).toThrow()
  })

  test('validateTemplateRefs transition.from unknown', () => {
    const bad: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 'a', type: 'start' }],
      transitions: [{ from: 'x', to: 'a', on: 'go' }],
      catalog: {},
      actions: [],
    }
    expect(() => validateTemplateRefs(bad)).toThrow()
  })
})
