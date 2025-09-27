import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

export class StatusMessage extends DidCommMessage {
  public static readonly type = parseMessageType('https://didcomm.org/workflow/1.0/status')

  @IsValidMessageType(StatusMessage.type)
  public type = StatusMessage.type.messageTypeUri

  public body!: {
    instance_id: string
    state: string
    section?: string
    allowed_events: string[]
    action_menu: Array<{ label?: string; event: string }>
    artifacts: Record<string, unknown>
    ui?: import('../../model/types').UiItem[]
  }

  public constructor(options?: { id?: string; body: StatusMessage['body']; thid?: string }) {
    super()
    this.type = StatusMessage.type.messageTypeUri
    if (options) {
      this.id = options.id || this.generateId()
      this.body = options.body
      if (options.thid) this.setThread({ threadId: options.thid })
    }
  }
}
