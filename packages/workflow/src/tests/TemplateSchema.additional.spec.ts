import { validateTemplateJson } from '../src'

describe('Schemas extra invalid cases', () => {
  test('invalid instance_policy (missing mode)', () => {
    const bad: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: {},
      states: [],
      transitions: [],
      catalog: {},
      actions: [],
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })

  test('transitions invalid item shape', () => {
    const bad: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 's', type: 'start' }],
      transitions: [{ foo: 'bar' }],
      catalog: {},
      actions: [],
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })

  test('actions invalid profile_ref pattern rejected by schema', () => {
    const bad: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 's', type: 'start' }],
      transitions: [],
      catalog: {},
      actions: [{ key: 'a', typeURI: 'x', profile_ref: 'zz.x' }],
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })

  test('sections invalid item (missing name)', () => {
    const bad: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      sections: [{}],
      states: [{ name: 's', type: 'start' }],
      transitions: [],
      catalog: {},
      actions: [],
    }
    expect(() => validateTemplateJson(bad)).toThrow()
  })
})
