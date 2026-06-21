// The recipient is always the authenticated user (req.user.email), so the
// client sends no body. This DTO exists as a stable contract / extension point.
export class SendGenerationEmailDto {}
