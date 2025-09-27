import { AttributeSpec, WorkflowInstanceData } from '../model/types'

const isObject = (v: any) => v && typeof v === 'object' && !Array.isArray(v)

export class AttributePlanner {
  public static materialize(plan: Record<string, AttributeSpec>, instance: WorkflowInstanceData): Record<string, any> {
    const out: Record<string, any> = {}
    for (const [key, spec] of Object.entries(plan || {})) {
      let value: any
      if ((spec as any).source === 'context') {
        const p = (spec as any).path as string
        value = AttributePlanner.getByPath(instance.context || {}, p)
      } else if ((spec as any).source === 'static') {
        value = (spec as any).value
      } else if ((spec as any).source === 'compute') {
        value = AttributePlanner.computeExpr((spec as any).expr)
      }
      if ((spec as any).required && (value === undefined || value === null || value === '')) {
        throw Object.assign(new Error('missing_attributes'), { code: 'missing_attributes', attribute: key })
      }
      if (value !== undefined) out[key] = value
    }
    return out
  }

  private static getByPath(obj: any, path: string) {
    return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj)
  }

  private static computeExpr(expr: string): any {
    // Limited helpers: now(), concat(a,b,...)
    const helpers = {
      now: () => new Date().toISOString(),
      concat: (...args: any[]) => args.map((a) => (a == null ? '' : String(a))).join(''),
    }
    try {
      const fn = new Function('now', 'concat', `return ((${expr}));`)
      return fn(helpers.now, helpers.concat)
    } catch {
      return undefined
    }
  }
}

export const deepMerge = (target: any, source: any) => {
  if (!isObject(target) || !isObject(source)) return source
  for (const [k, v] of Object.entries(source)) {
    if (isObject(v)) {
      if (!isObject(target[k])) target[k] = {}
      deepMerge(target[k], v)
    } else {
      target[k] = v
    }
  }
  return target
}
