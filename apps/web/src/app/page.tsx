import Link from 'next/link';
import { PricingTiers } from '@/components/PricingTiers';

const features = [
  {
    title: 'מודלי AI מרובים',
    desc: 'בחר מתוך Replicate, Fal.ai, OpenAI ו-Stability AI — המודל המתאים לכל משימה.',
    icon: PaletteIcon,
    tint: 'from-brand-500/20 to-brand-700/10 text-brand-300',
  },
  {
    title: 'תמונות השראה',
    desc: 'העלה תמונת reference ליצירת image-to-image והעברת סגנון מדויקת.',
    icon: ImageIcon,
    tint: 'from-accent-500/20 to-accent-700/10 text-accent-300',
  },
  {
    title: 'מערכת קרדיטים הוגנת',
    desc: 'שלם רק על מה שאתה משתמש — בלי מנוי, בלי תפוגה, בלי הפתעות.',
    icon: GemIcon,
    tint: 'from-fuchsia-500/20 to-fuchsia-700/10 text-fuchsia-300',
  },
];

const steps = [
  { num: '1', title: 'כתוב פרומפט', desc: 'תאר במילים את הויזואל שאתה מדמיין.' },
  { num: '2', title: 'בחר מודל וסגנון', desc: 'התאם מודל, יחס תמונה ואיכות יצירה — או העלה תמונת השראה.' },
  { num: '3', title: 'צור והורד', desc: 'תוך שניות מקבלים תוצאה מוכנה להורדה ושיתוף.' },
];

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="glow-orb -top-32 right-[-10%] h-[28rem] w-[28rem] bg-brand-700/40 animate-float-slow" />
      <div className="glow-orb top-40 left-[-10%] h-[24rem] w-[24rem] bg-accent-600/25 animate-float-slow" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-grid" />

      <section className="relative max-w-6xl mx-auto px-4 pt-24 pb-28 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-900/30 border border-brand-700/40 rounded-full px-4 py-1.5 text-sm text-brand-200 mb-8 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
          סטודיו AI לתמונות ווידאו
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
          הופכים רעיונות
          <br />
          <span className="gradient-text">לויזואלים מרהיבים</span>
        </h1>

        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
          צור תמונות וסרטונים עם Flux, DALL·E, Stable Diffusion ועוד.
          העלה תמונות השראה, בחר מודל, והפוך מילים למציאות — תוך שניות.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/register" className="btn-primary text-lg px-8 py-3">
            התחילו ליצור — חינם
          </Link>
          <Link href="/login" className="btn-secondary text-lg px-8 py-3">
            כבר יש לי חשבון
          </Link>
        </div>

        <p className="text-sm text-gray-500 mt-5">
          150 קרדיטים חינם בהרשמה · ללא צורך בכרטיס אשראי
        </p>
      </section>

      <section className="relative max-w-6xl mx-auto px-4 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="card-interactive text-right">
                <div
                  className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.tint}`}
                >
                  <Icon />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-6">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="relative max-w-6xl mx-auto px-4 pb-24">
        <h2 className="text-3xl font-bold text-center mb-3">איך זה עובד?</h2>
        <p className="text-center text-gray-400 mb-12">שלושה צעדים מהרעיון לתוצאה</p>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div key={step.num} className="relative card text-right">
              <span className="absolute -top-4 right-6 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-glow-sm">
                {step.num}
              </span>
              <h3 className="text-lg font-semibold mb-2 mt-2">{step.title}</h3>
              <p className="text-gray-400 text-sm leading-6">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative border-t border-surface-border bg-surface-card/40">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <h2 className="text-3xl font-bold text-center mb-3">תמחור פשוט והוגן</h2>
          <p className="text-center text-gray-400 mb-12">
            חבילות קרדיטים לפי שימוש — בלי מנוי ובלי תפוגה.
          </p>
          <PricingTiers />
        </div>
      </section>

      <section className="relative max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="relative overflow-hidden rounded-3xl border border-brand-700/40 bg-gradient-to-br from-brand-900/40 via-surface-card to-surface-card p-12 shadow-glow">
          <div className="glow-orb -top-16 left-1/2 h-64 w-64 -translate-x-1/2 bg-brand-600/40" />
          <h2 className="relative text-3xl md:text-4xl font-bold mb-4">
            מוכנים ליצור משהו מדהים?
          </h2>
          <p className="relative text-gray-400 mb-8">
            הצטרפו עכשיו וקבלו 150 קרדיטים חינם להתחלה.
          </p>
          <Link href="/register" className="relative btn-primary text-lg px-8 py-3">
            יוצרים את היצירה הראשונה
          </Link>
        </div>
      </section>
    </div>
  );
}

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21a9 9 0 1 1 0-18c4.97 0 9 3.58 9 8 0 2.5-2 3.5-3.5 3.5H15a2 2 0 0 0-1.6 3.2A1.5 1.5 0 0 1 12 21Z" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" />
      <circle cx="16.5" cy="10.5" r="1" fill="currentColor" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-4.5-4.5L7 21" />
    </svg>
  );
}

function GemIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 12L2 9Z" />
      <path d="M2 9h20" />
      <path d="m12 21 4-12-4-6-4 6 4 12Z" />
    </svg>
  );
}
