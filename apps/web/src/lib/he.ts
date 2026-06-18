export const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין',
  processing: 'מעבד',
  done: 'הושלם',
  failed: 'נכשל',
};

function referenceImageLabel(imageNumber?: string): string {
  const labels: Record<string, string> = {
    '1': 'הראשונה',
    '2': 'השנייה',
    '3': 'השלישית',
    '4': 'הרביעית',
    '5': 'החמישית',
  };
  return labels[imageNumber ?? ''] ?? 'שהועלתה';
}

export function translateError(message: string): string {
  if (message.includes('OPENAI_SAFETY_REJECTED')) {
    const requestId = message.match(/\breq_[a-zA-Z0-9]+\b/)?.[0];
    return `OpenAI דחתה את הבקשה בגלל מערכת הבטיחות. נסה לשנות את התיאור או להסיר פרטים שעלולים להיחסם.${requestId ? ` מזהה בקשה: ${requestId}` : ''}`;
  }

  if (message.includes('OPENAI_INVALID_REFERENCE_IMAGE')) {
    const imageNumber = message.match(/OPENAI_INVALID_REFERENCE_IMAGE_(\d+)/)?.[1];
    return `אי אפשר להשתמש בתמונת ההשראה ${referenceImageLabel(imageNumber)}: הקובץ לא תקין או בפורמט תמונה ש-OpenAI לא תומך בו. כדאי להעלות אותה מחדש כ-JPG או PNG רגיל (RGB).`;
  }

  if (
    message.includes('rejected by the safety system') ||
    message.includes('content_policy_violation')
  ) {
    const requestId = message.match(/\breq_[a-zA-Z0-9]+\b/)?.[0];
    return `OpenAI דחתה את הבקשה בגלל מערכת הבטיחות. נסה לשנות את התיאור או להסיר פרטים שעלולים להיחסם.${requestId ? ` מזהה בקשה: ${requestId}` : ''}`;
  }

  if (
    message.includes('invalid_image_file') ||
    message.includes('Invalid image file or mode')
  ) {
    const imageNumber = message.match(/image\s+(\d+)/i)?.[1];
    return `אי אפשר להשתמש בתמונת ההשראה ${referenceImageLabel(imageNumber)}: הקובץ לא תקין או בפורמט תמונה ש-OpenAI לא תומך בו. כדאי להעלות אותה מחדש כ-JPG או PNG רגיל (RGB).`;
  }

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
