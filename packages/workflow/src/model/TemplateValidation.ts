import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import type { WorkflowTemplate } from './types'

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)

const schema = {
  type: 'object',
  required: ['template_id', 'version', 'title', 'instance_policy', 'states', 'transitions', 'catalog', 'actions'],
  properties: {
    template_id: { type: 'string', minLength: 1 },
    version: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    instance_policy: {
      type: 'object',
      required: ['mode'],
      properties: {
        mode: { enum: ['singleton_per_connection', 'multi_per_connection'] },
        multiplicity_key: { type: 'string' },
      },
      additionalProperties: false,
    },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' }, order: { type: 'number' }, icon: { type: 'string' } },
        additionalProperties: true,
      },
    },
    states: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string' },
          type: { enum: ['start', 'normal', 'final'] },
          section: { type: 'string' },
        },
        additionalProperties: true,
      },
    },
    transitions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['from', 'to', 'on'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          on: { type: 'string' },
          guard: { type: 'string' },
          action: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    catalog: {
      type: 'object',
      properties: {
        credential_profiles: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            required: ['cred_def_id', 'attribute_plan', 'to_ref'],
            properties: {
              cred_def_id: { type: 'string' },
              attribute_plan: {
                type: 'object',
                additionalProperties: {
                  anyOf: [
                    {
                      type: 'object',
                      required: ['source', 'path'],
                      properties: {
                        source: { const: 'context' },
                        path: { type: 'string' },
                        required: { type: 'boolean' },
                      },
                      additionalProperties: false,
                    },
                    {
                      type: 'object',
                      required: ['source', 'value'],
                      properties: { source: { const: 'static' }, value: {}, required: { type: 'boolean' } },
                      additionalProperties: false,
                    },
                    {
                      type: 'object',
                      required: ['source', 'expr'],
                      properties: {
                        source: { const: 'compute' },
                        expr: { type: 'string' },
                        required: { type: 'boolean' },
                      },
                      additionalProperties: false,
                    },
                  ],
                },
              },
              to_ref: { type: 'string' },
              options: { type: 'object', additionalProperties: true },
            },
            additionalProperties: false,
          },
        },
        proof_profiles: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            required: ['to_ref'],
            properties: {
              schema_id: { type: 'string' },
              cred_def_id: { type: 'string' },
              requested_attributes: { type: 'array', items: { type: 'string' } },
              requested_predicates: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['name', 'p_type', 'p_value'],
                  properties: { name: { type: 'string' }, p_type: { type: 'string' }, p_value: { type: 'number' } },
                  additionalProperties: false,
                },
              },
              to_ref: { type: 'string' },
              options: { type: 'object', additionalProperties: true },
            },
            additionalProperties: false,
          },
        },
        defaults: { type: 'object' },
      },
      additionalProperties: true,
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'typeURI'],
        properties: {
          key: { type: 'string' },
          typeURI: { type: 'string' },
          profile_ref: { type: 'string', pattern: '^(cp|pp)\\.' },
          staticInput: {},
        },
        additionalProperties: true,
      },
    },
    display_hints: { type: 'object' },
  },
  additionalProperties: false,
}

const validate = ajv.compile(schema as unknown as object)

export function validateTemplateJson(tpl: unknown) {
  const ok = validate(tpl)
  if (!ok) {
    const errs = (validate.errors || []) as Array<{ instancePath?: string; message?: string }>
    const msg = errs.map((e) => `${e.instancePath || 'template'} ${e.message}`).join('; ')
    const err = new Error(msg) as Error & { code: string }
    err.code = 'invalid_template'
    throw err
  }
}

export function validateTemplateRefs(t: WorkflowTemplate) {
  // Structural checks beyond schema
  const stateNames = new Set(t.states.map((s) => s.name))
  if (![...t.states].some((s) => s.type === 'start')) {
    const err = new Error('start state required') as Error & { code?: string }
    err.code = 'invalid_template'
    throw err
  }
  for (const s of t.states) {
    if (s.section && !t.sections?.some((sec) => sec.name === s.section)) {
      const err = new Error(`state.section not found: ${s.section}`) as Error & { code?: string }
      err.code = 'invalid_template'
      throw err
    }
  }
  for (const tr of t.transitions) {
    if (!stateNames.has(tr.from)) {
      const err = new Error(`transition.from unknown: ${tr.from}`) as Error & { code?: string }
      err.code = 'invalid_template'
      throw err
    }
    if (!stateNames.has(tr.to)) {
      const err = new Error(`transition.to unknown: ${tr.to}`) as Error & { code?: string }
      err.code = 'invalid_template'
      throw err
    }
    if (tr.action && !t.actions.some((a) => a.key === tr.action)) {
      const err = new Error(`transition.action unknown: ${tr.action}`) as Error & { code?: string }
      err.code = 'invalid_template'
      throw err
    }
  }
  for (const a of t.actions) {
    if ('profile_ref' in a) {
      const pr = (a as { profile_ref: string }).profile_ref
      if (pr.startsWith('cp.')) {
        const key = pr.slice(3)
        if (!t.catalog?.credential_profiles || !t.catalog.credential_profiles[key]) {
          const err = new Error(`catalog.cp missing: ${key}`)
          ;(err as Error & { code?: string }).code = 'invalid_template'
          throw err
        }
      } else if (pr.startsWith('pp.')) {
        const key = pr.slice(3)
        if (!t.catalog?.proof_profiles || !t.catalog.proof_profiles[key]) {
          const err = new Error(`catalog.pp missing: ${key}`)
          ;(err as Error & { code?: string }).code = 'invalid_template'
          throw err
        }
      } else if (typeof pr === 'string') {
        const err = new Error(`invalid profile_ref: ${pr}`)
        ;(err as Error & { code?: string }).code = 'invalid_template'
        throw err
      }
    }
  }
}
