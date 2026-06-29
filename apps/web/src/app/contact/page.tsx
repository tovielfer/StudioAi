import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/app/_components/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: `צור קשר — ${LEGAL.brandName}`,
  description: `דרכי יצירת קשר עם ${LEGAL.brandName}.`,
};

export default function ContactPage() {
  return (
    <LegalPage
      title="צור קשר"
      intro="נשמח לעמוד לרשותך בכל שאלה, בקשה או בעיה. הנה הדרכים ליצור איתנו קשר:"
    >
      <LegalSection title="פרטי העסק">
        <ul className="list-none space-y-2">
          <li>
            <span className="text-gray-400">שם העסק: </span>
            {LEGAL.legalName}
          </li>
          {LEGAL.businessId ? (
            <li>
              <span className="text-gray-400">ח.פ. / עוסק מורשה: </span>
              {LEGAL.businessId}
            </li>
          ) : null}
          <li>
            <span className="text-gray-400">כתובת: </span>
            {LEGAL.address}
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="דרכי התקשרות">
        <ul className="list-none space-y-3">
          <li>
            <span className="text-gray-400">אימייל: </span>
            <a
              href={`mailto:${LEGAL.email}`}
              className="text-brand-300 hover:text-brand-200 underline"
            >
              {LEGAL.email}
            </a>
          </li>
          {LEGAL.phone ? (
            <li>
              <span className="text-gray-400">טלפון: </span>
              <a
                href={`tel:${LEGAL.phone}`}
                className="text-brand-300 hover:text-brand-200 underline"
              >
                {LEGAL.phone}
              </a>
            </li>
          ) : null}
        </ul>
      </LegalSection>

      <LegalSection title="פנייה דרך השירות">
        <p>
          משתמשים רשומים יכולים לפתוח פנייה ישירות מתוך החשבון בעמוד{' '}
          <Link
            href="/feedback"
            className="text-brand-300 hover:text-brand-200 underline"
          >
            הפניות
          </Link>
          , ונחזור אליך בהקדם.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
