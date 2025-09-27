import jmespath from 'jmespath'
import { AttributeSpec, WorkflowInstanceData } from '../model/types'

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

// biome-ignore lint/complexity/noStaticOnlyClass: Utility holder class for attribute planning
export class AttributePlanner {
  public static materialize(
    plan: Record<string, AttributeSpec>,
    instance: WorkflowInstanceData
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [key, spec] of Object.entries(plan || {})) {
      let value: unknown
      if (spec.source === 'context') {
        const p = spec.path
        value = AttributePlanner.getByPath((instance.context || {}) as Record<string, unknown>, p)
      } else if (spec.source === 'static') {
        value = spec.value
      } else if (spec.source === 'compute') {
        value = AttributePlanner.computeExpr(spec.expr, instance)
      }
      if (spec.required && (value === undefined || value === null || value === '')) {
        const err = new Error('missing_attributes') as Error & { code: string; attribute: string }
        err.code = 'missing_attributes'
        err.attribute = key
        throw err
      }
      if (value !== undefined) out[key] = value
    }
    return out
  }

  private static getByPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, part) => {
      if (acc === null || acc === undefined) return undefined
      if (typeof acc !== 'object') return undefined
      const rec = acc as Record<string, unknown>
      return rec[part]
    }, obj)
  }

  private static computeExpr(expr: string, instance: WorkflowInstanceData): unknown {
    // Evaluate compute expressions using JMESPath over a pure env
    // Expose a stable 'now' value as an ISO string for this evaluation
    const env = {
      context: instance.context || {},
      participants: instance.participants || {},
      artifacts: instance.artifacts || {},
      now: new Date().toISOString(),
    }
    try {
      const jpSearch = jmespath.search as unknown as (obj: unknown, expr: string) => unknown
      return jpSearch(env, expr)
    } catch {
      return undefined
    }
  }
}

export const deepMerge = (
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> => {
  if (!isObject(target) || !isObject(source)) return source
  for (const [k, v] of Object.entries(source)) {
    if (isObject(v)) {
      if (!isObject(target[k])) target[k] = {}
      deepMerge(target[k] as Record<string, unknown>, v)
    } else {
      target[k] = v
    }
  }
  return target
}
