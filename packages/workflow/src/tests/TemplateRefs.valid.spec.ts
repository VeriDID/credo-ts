import { validateTemplateRefs } from '..'

describe('validateTemplateRefs positive (cp.* and pp.*)', () => {
  test('cp.* and pp.* profile_ref resolve to catalog entries', () => {
    const tpl: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      sections: [{ name: 'Main' }],
      states: [{ name: 'a', type: 'start', section: 'Main' }],
      transitions: [
        { from: 'a', to: 'a', on: 'go', action: 'issue' },
        { from: 'a', to: 'a', on: 'ask', action: 'proof' },
      ],
      catalog: {
        credential_profiles: { test: { cred_def_id: 'C', attribute_plan: {}, to_ref: 'holder' } },
        proof_profiles: { demo: { requested_attributes: [], requested_predicates: [], to_ref: 'holder' } },
      },
      actions: [
        { key: 'issue', typeURI: 'https://didcomm.org/issue-credential/2.0/offer-credential', profile_ref: 'cp.test' },
        { key: 'proof', typeURI: 'https://didcomm.org/present-proof/2.0/request-presentation', profile_ref: 'pp.demo' },
      ],
    }
    expect(() => validateTemplateRefs(tpl)).not.toThrow()
  })
})
