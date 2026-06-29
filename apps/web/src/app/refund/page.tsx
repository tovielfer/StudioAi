import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/app/_components/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: `מדיניות ביטולים והחזרים — ${LEGAL.brandName}`,
  description: `מדיניות הביטולים וההחזרים של ${LEGAL.brandName} בהתאם לחוק הגנת הצרכן.`,
};

export default function RefundPage() {
  return (
    <LegalPage
      title="מדיניות ביטולים והחזרים"
      intro={`מדיניות זו מפרטת את זכויות הביטול וההחזר ברכישת קרדיטים ב-${LEGAL.brandName}, בהתאם לחוק הגנת הצרכן, התשמ״א-1981 ולתקנותיו.`}
    >
      <LegalSection title="1. אופי המוצר">
        <p>
          הקרדיטים הנרכשים בשירות מהווים "תוכן דיגיטלי" המאפשר יצירת תמונות וסרטונים.
          השירות מסופק באופן מיידי לאחר התשלום.
        </p>
      </LegalSection>

      <LegalSection title="2. זכות ביטול עסקה">
        <p>
          על פי חוק הגנת הצרכן, ניתן לבטל עסקה לרכישת תוכן דיגיטלי בתוך 14 ימים
          מיום ביצוע העסקה, <strong>ובלבד שטרם נעשה שימוש בקרדיטים שנרכשו</strong>.
          מרגע שנעשתה יצירה (ולו אחת) בקרדיטים שנרכשו, התוכן נחשב כ"נצרך" וזכות
          הביטול עשויה שלא לחול עליו.
        </p>
      </LegalSection>

      <LegalSection title="3. אופן הביטול">
        <p>
          לביטול עסקה יש לפנות אלינו בכתובת {LEGAL.email}
          {LEGAL.phone ? ` או בטלפון ${LEGAL.phone}` : ''}, בציון שם מלא, כתובת
          אימייל החשבון ופרטי העסקה. נשתדל לטפל בפנייה בהקדם.
        </p>
      </LegalSection>

      <LegalSection title="4. ביצוע ההחזר">
        <p>
          במקרה של ביטול המזכה בהחזר, הכספים יושבו לאמצעי התשלום שבו בוצעה הרכישה,
          בהתאם להוראות הדין. ייתכן ניכוי דמי ביטול כמותר בחוק (עד 5% או 100 ₪,
          לפי הנמוך).
        </p>
      </LegalSection>

      <LegalSection title="5. קרדיטים שנוצלו">
        <p>
          קרדיטים שנוצלו ליצירת תכנים אינם ניתנים להחזר כספי, שכן השירות כבר סופק.
          קרדיטי מתנה / חינם אינם ניתנים להמרה לכסף.
        </p>
      </LegalSection>

      <LegalSection title="6. תקלות וחיובים שגויים">
        <p>
          אם נגבית ממך תשלום בטעות, או אם יצירה נכשלה עקב תקלה מצדנו והקרדיטים לא
          הוחזרו אוטומטית — פנה אלינו ונבדוק ונתקן את העניין.
        </p>
      </LegalSection>

      <LegalSection title="7. יצירת קשר">
        <p>
          לכל שאלה בנושא ביטולים והחזרים: {LEGAL.email}
          {LEGAL.phone ? ` / ${LEGAL.phone}` : ''}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
