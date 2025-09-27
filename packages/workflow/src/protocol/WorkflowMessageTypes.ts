export const WorkflowMessageType = {
  PublishTemplate: 'https://didcomm.org/workflow/1.0/publish-template',
  Start: 'https://didcomm.org/workflow/1.0/start',
  Advance: 'https://didcomm.org/workflow/1.0/advance',
  Status: 'https://didcomm.org/workflow/1.0/status',
  ProblemReport: 'https://didcomm.org/workflow/1.0/problem-report',
  Pause: 'https://didcomm.org/workflow/1.0/pause',
  Resume: 'https://didcomm.org/workflow/1.0/resume',
  Cancel: 'https://didcomm.org/workflow/1.0/cancel',
  Complete: 'https://didcomm.org/workflow/1.0/complete',
} as const
