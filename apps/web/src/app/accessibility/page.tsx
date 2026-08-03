import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/app/_components/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: `הצהרת נגישות — ${LEGAL.brandName}`,
  description: `הצהרת הנגישות של ${LEGAL.brandName}.`,
};

export default function AccessibilityPage() {
  return (
    <LegalPage
      title="הצהרת נגישות"
      intro={`ב-${LEGAL.brandName} אנו רואים חשיבות רבה במתן שירות שוויוני ונגיש לכלל המשתמשים, לרבות אנשים עם מוגבלות, בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ״ח-1998 ולתקנות מכוחו.`}
    >
      <LegalSection title="1. מאמצי הנגישות באתר">
        <ul className="list-disc pr-6 space-y-2">
          <li>האתר נבנה בתמיכה בקוראי מסך ובניווט באמצעות מקלדת.</li>
          <li>שימוש במבנה כותרות ותגיות סמנטיות לקריאות טובה יותר.</li>
          <li>שמירה על ניגודיות צבעים סבירה בין טקסט לרקע.</li>
          <li>תאימות לדפדפנים מודרניים ולמכשירים ניידים.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. רמת הנגישות">
        <p>
          אנו פועלים להנגיש את האתר בהתאם להמלצות התקן הישראלי (ת״י 5568) המבוסס על
          הנחיות WCAG 2.0 ברמה AA, במידת האפשר.
        </p>
      </LegalSection>

      <LegalSection title="3. הסתייגויות">
        <p>
          על אף מאמצינו, ייתכן שחלקים מסוימים באתר טרם הונגשו במלואם, או שתכנים
          שנוצרים באופן אוטומטי (כגון תמונות וסרטונים שנוצרו על ידי AI) אינם נגישים
          מעצם טבעם. אנו ממשיכים לפעול לשיפור הנגישות באופן שוטף.
        </p>
      </LegalSection>

      <LegalSection title="4. פנייה בנושא נגישות">
        <p>
          נתקלת בבעיית נגישות, או זקוק לסיוע? נשמח לקבל את פנייתך ולטפל בה בהקדם.
        </p>
        <ul className="list-disc pr-6 space-y-2">
          <li>רכז/ת נגישות: {LEGAL.accessibilityContact}</li>
          <li>אימייל: {LEGAL.email}</li>
          {LEGAL.phone ? <li>טלפון: {LEGAL.phone}</li> : null}
          <li>כתובת: {LEGAL.address}</li>
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
