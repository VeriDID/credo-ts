import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

export class CancelMessage extends DidCommMessage {
  public static readonly type = parseMessageType('https://didcomm.org/workflow/1.0/cancel')

  @IsValidMessageType(CancelMessage.type)
  public type = CancelMessage.type.messageTypeUri

  public body!: { instance_id: string; reason?: string }

  public constructor(options?: { id?: string; body: CancelMessage['body']; thid?: string }) {
    super()
    this.type = CancelMessage.type.messageTypeUri
    if (options) {
      this.id = options.id || this.generateId()
      this.body = options.body
      if (options.thid) this.setThread({ threadId: options.thid })
    }
  }
}
