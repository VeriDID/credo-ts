export type GuardEngine = 'jmespath' | 'cel' | 'js'

export interface WorkflowModuleConfigOptions {
  guardEngine?: GuardEngine
  autoReturnExistingOnSingleton?: boolean
  actionTimeoutMs?: number
  enableProblemReport?: boolean
}

export class WorkflowModuleConfig {
  public readonly guardEngine: GuardEngine
  public readonly autoReturnExistingOnSingleton: boolean
  public readonly actionTimeoutMs: number
  public readonly enableProblemReport: boolean

  public constructor(options?: WorkflowModuleConfigOptions) {
    this.guardEngine = options?.guardEngine ?? 'jmespath'
    this.autoReturnExistingOnSingleton = options?.autoReturnExistingOnSingleton ?? true
    this.actionTimeoutMs = options?.actionTimeoutMs ?? 15000
    this.enableProblemReport = options?.enableProblemReport ?? true
  }
}
