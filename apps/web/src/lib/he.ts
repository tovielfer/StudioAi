export const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין',
  processing: 'מעבד',
  done: 'הושלם',
  failed: 'נכשל',
};

export function translateError(message: string): string {
  const map: Record<string, string> = {
    'Email already registered': 'כתובת האימייל כבר רשומה',
    'Invalid credentials': 'פרטי התחברות שגויים',
    'Insufficient credits': 'אין מספיק קרדיטים',
    'Login failed': 'ההתחברות נכשלה',
    'Registration failed': 'ההרשמה נכשלה',
    'Generation failed': 'יצירת התמונה נכשלה',
    'Please enter a prompt': 'יש להזין תיאור (prompt)',
    'Reference image must be under 5MB': 'תמונת ההשראה חייבת להיות עד 5MB',
    'Prompt must be at least 3 characters': 'התיאור חייב להכיל לפחות 3 תווים',
    'Prompt must be under 2000 characters': 'התיאור חייב להיות עד 2000 תווים',
    'Prompt contains content that violates our guidelines':
      'התיאור מכיל תוכן שאינו עומד בכללי השימוש',
    'Rate limit exceeded. Try again in a minute.':
      'חרגת ממגבלת הבקשות. נסה שוב בעוד דקה',
  };
  return map[message] ?? message;
}
