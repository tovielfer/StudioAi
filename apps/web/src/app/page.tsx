import Link from 'next/link';
import { PricingTiers } from '@/components/PricingTiers';

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-900/30 via-transparent to-transparent" />

      <section className="relative max-w-6xl mx-auto px-4 pt-24 pb-32 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-900/30 border border-brand-700/30 rounded-full px-4 py-1.5 text-sm text-brand-300 mb-8">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          סטודיו AI לתמונות ווידאו
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
          צור ויזואלים מרהיבים
          <br />
          <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
            בעזרת בינה מלאכותית
          </span>
        </h1>

        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
          צור תמונות עם Flux, DALL-E, Stable Diffusion ועוד.
          העלה תמונות השראה, בחר מודל, והפוך רעיונות למציאות.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link href="/register" className="btn-primary text-lg px-8 py-3">
            התחל בחינם
          </Link>
          <Link href="/login" className="btn-secondary text-lg px-8 py-3">
            התחברות
          </Link>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          150 קרדיטים חינם בהרשמה — ללא צורך בכרטיס אשראי
        </p>
      </section>

      <section className="relative max-w-6xl mx-auto px-4 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: 'מודלי AI מרובים',
              desc: 'בחר מתוך Replicate, Fal.ai, OpenAI ו-Stability AI.',
              icon: '🎨',
            },
            {
              title: 'תמונות השראה',
              desc: 'העלה תמונת reference ליצירת image-to-image והעברת סגנון.',
              icon: '🖼️',
            },
            {
              title: 'מערכת קרדיטים',
              desc: 'שלם רק על מה שאתה משתמש — בלי מנוי ובלי תפוגת קרדיטים.',
              icon: '💎',
            },
          ].map((feature) => (
            <div key={feature.title} className="card text-right">
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-surface-border bg-surface-card/50">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-3">תמחור</h2>
          <p className="text-center text-gray-400 mb-10">
            חבילות קרדיטים לפי שימוש. ככל שהחבילה גדולה יותר — זול יותר לקרדיט.
          </p>
          <PricingTiers />
        </div>
      </section>
    </div>
  );
}
