import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

export class StatusRequestMessage extends DidCommMessage {
  public static readonly type = parseMessageType('https://didcomm.org/workflow/1.0/status')

  @IsValidMessageType(StatusRequestMessage.type)
  public type = StatusRequestMessage.type.messageTypeUri

  public body!: { instance_id: string; include_actions?: boolean; include_ui?: boolean }

  public constructor(options?: { id?: string; body: StatusRequestMessage['body']; thid?: string }) {
    super()
    this.type = StatusRequestMessage.type.messageTypeUri
    if (options) {
      this.id = options.id || this.generateId()
      this.body = options.body
      if (options.thid) this.setThread({ threadId: options.thid })
    }
  }
}
