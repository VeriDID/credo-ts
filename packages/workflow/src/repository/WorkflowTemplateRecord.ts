import type { TagsBase } from '@credo-ts/core'
import { BaseRecord, utils } from '@credo-ts/core'
import type { WorkflowTemplate } from '../model/types'

export interface WorkflowTemplateRecordProps {
  id?: string
  createdAt?: Date
  template: WorkflowTemplate
  hash?: string
  tags?: TagsBase
}

export type DefaultWorkflowTemplateTags = {
  templateId: string
  version: string
  hash?: string
}

export class WorkflowTemplateRecord
  extends BaseRecord<DefaultWorkflowTemplateTags, TagsBase>
  implements WorkflowTemplateRecordProps
{
  public template!: WorkflowTemplate
  public hash?: string

  public static readonly type = 'WorkflowTemplateRecord'
  public readonly type = WorkflowTemplateRecord.type

  public constructor(props: WorkflowTemplateRecordProps) {
    super()
    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.template = props.template
      this.hash = props.hash
      this._tags = props.tags ?? {}
    }
  }

  public getTags(): DefaultWorkflowTemplateTags {
    return {
      ...this._tags,
      templateId: this.template?.template_id,
      version: this.template?.version,
      hash: this.hash,
    }
  }
}
