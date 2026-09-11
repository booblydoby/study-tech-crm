import Link from "next/link";
import { Clock, GraduationCap, Mail, MapPin, MessageCircle, Monitor, Phone, Sparkles, Users } from "lucide-react";
import { AmbientBackground } from "@/components/landing/ambient-background";
import { LocationMap } from "@/components/landing/location-map";
import { SubjectsSection } from "@/components/landing/subjects-section";
import { siteConfig } from "@/lib/site-config";

const navLinks = [
  { href: "#about", label: "О нас" },
  { href: "#subjects", label: "Направления" },
  { href: "#contacts", label: "Контакты" }
];

export default function LandingPage() {
  const { contacts, location, hours } = siteConfig;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a0a0a] text-white">
      <AmbientBackground />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0a0a0a]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-yellow via-brand-amber to-brand-orange shadow-lg shadow-orange-500/30">
              <GraduationCap size={22} className="text-[#0a0a0a]" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">{siteConfig.name}</p>
              <p className="text-xs text-white/45">{siteConfig.tagline}</p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-white/55 transition-colors hover:text-brand-yellow"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <Link href="/login" className="landing-btn landing-btn-outline landing-btn-sm hidden sm:inline-flex">
            Вход для учеников
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 md:pt-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="animate-fade-up mb-5 inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/5 px-4 py-1.5 text-xs font-medium text-brand-yellow">
                <Sparkles size={14} className="animate-pulse-glow" />
                {siteConfig.tagline}
              </div>

              <h1 className="animate-fade-up-delay-1 text-4xl font-extrabold leading-[1.08] tracking-tight md:text-5xl lg:text-[3.4rem]">
                Развиваем <span className="landing-gradient-text">знания</span> с заботой о каждом{" "}
                <span className="landing-gradient-text">ученике</span>
              </h1>

              <p className="animate-fade-up-delay-2 mt-6 max-w-lg text-lg leading-relaxed text-white/60">
                {siteConfig.description}
              </p>

              <div className="animate-fade-up-delay-3 mt-10 flex flex-wrap gap-4">
                <a href="#contacts" className="landing-btn landing-btn-primary landing-btn-lg">
                  <Phone size={16} />
                  Записаться на занятие
                </a>
                <a href="#subjects" className="landing-btn landing-btn-outline landing-btn-lg">
                  Наши направления
                </a>
              </div>

              <div className="animate-fade-up-delay-3 mt-12 flex flex-wrap gap-8 border-t border-white/10 pt-8">
                {siteConfig.stats.map((s) => (
                  <div key={s.label}>
                    <p className="text-2xl font-bold landing-gradient-text">{s.value}</p>
                    <p className="mt-0.5 text-xs uppercase tracking-wider text-white/40">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero visual */}
            <div className="animate-fade-up-delay-2 relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-orange/25 via-brand-yellow/10 to-transparent blur-2xl" />
              <div className="landing-glass-strong relative overflow-hidden rounded-3xl p-8 shadow-2xl shadow-black/50">
                <div className="absolute -right-8 -top-8 size-32 rounded-full bg-brand-orange/10 blur-2xl" />
                <p className="text-xs font-medium uppercase tracking-widest text-brand-amber">Study Tech</p>
                <h2 className="mt-3 text-2xl font-bold leading-snug">
                  Место, где <span className="landing-gradient-text">учиться интересно</span>
                </h2>
                <ul className="mt-6 space-y-3">
                  {[
                    "Английский · Математика · Китайский",
                    "Онлайн и оффлайн занятия",
                    "IELTS · SAT · HSK · олимпиады",
                    "Подготовка к лицеям и спецшколам"
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-white/65">
                      <span className="size-1.5 shrink-0 rounded-full bg-gradient-to-r from-brand-yellow to-brand-orange" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex items-center gap-4 rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-yellow-500/5 p-4">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-brand-yellow/15">
                    <Users size={22} className="text-brand-yellow" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Набор открыт</p>
                    <p className="text-xs text-white/45">Звоните или пишите в Telegram</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="border-t border-white/5 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-sm font-medium uppercase tracking-widest text-brand-amber">О нас</p>
                <h2 className="mt-3 text-3xl font-bold md:text-4xl">{siteConfig.about.title}</h2>
                <div className="mt-6 space-y-4 text-white/55 leading-relaxed">
                  {siteConfig.about.paragraphs.map((p) => (
                    <p key={p.slice(0, 24)}>{p}</p>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {siteConfig.advantages.map(({ title, text }) => (
                  <div key={title} className="landing-feature-card landing-glass rounded-2xl p-5">
                    <h3 className="font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Subjects */}
        <section id="subjects" className="border-t border-white/5 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mb-12 text-center">
              <p className="text-sm font-medium uppercase tracking-widest text-brand-amber">Направления</p>
              <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                Чему мы <span className="landing-gradient-text">учим</span>
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-white/45">
                Нажмите на карточку — откроется подробное описание программ
              </p>
            </div>

            <SubjectsSection />
          </div>
        </section>

        {/* Contacts + Map */}
        <section id="contacts" className="border-t border-white/5 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mb-12">
              <p className="text-sm font-medium uppercase tracking-widest text-brand-amber">Контакты</p>
              <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                Как нас <span className="landing-gradient-text">найти</span>
              </h2>
              <p className="mt-3 max-w-xl text-white/55">
                Приходите на пробное занятие или свяжитесь с нами — подберём группу и удобное время.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-5">
              {/* Contact cards */}
              <div className="flex flex-col gap-4 lg:col-span-2">
                <div className="landing-glass rounded-2xl p-5">
                  <div className="mb-3 flex items-center gap-2 text-brand-amber">
                    <MapPin size={18} />
                    <span className="text-sm font-medium">Адрес</span>
                  </div>
                  <p className="font-medium text-white">
                    {location.city}, {location.address}
                  </p>
                  <p className="mt-1 text-sm text-white/45">{location.district}</p>
                  <p className="mt-2 text-sm text-brand-yellow/80">{location.landmark}</p>
                </div>

                <div className="landing-glass rounded-2xl p-5">
                  <div className="mb-3 flex items-center gap-2 text-brand-amber">
                    <Phone size={18} />
                    <span className="text-sm font-medium">Телефоны</span>
                  </div>
                  <a
                    href={`tel:${contacts.phone.replace(/\s/g, "")}`}
                    className="block font-medium text-white hover:text-brand-yellow transition-colors"
                  >
                    {contacts.phone}
                  </a>
                  {contacts.phoneAlt && (
                    <a
                      href={`tel:${contacts.phoneAlt.replace(/\s/g, "")}`}
                      className="mt-1 block text-sm text-white/55 hover:text-brand-yellow transition-colors"
                    >
                      {contacts.phoneAlt}
                    </a>
                  )}
                </div>

                <div className="landing-glass rounded-2xl p-5">
                  <div className="mb-3 flex items-center gap-2 text-brand-amber">
                    <MessageCircle size={18} />
                    <span className="text-sm font-medium">Мессенджеры</span>
                  </div>
                  <a
                    href={`https://t.me/${contacts.telegram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-medium text-white hover:text-brand-yellow transition-colors"
                  >
                    Telegram {contacts.telegram}
                  </a>
                  <a
                    href={`https://instagram.com/${contacts.instagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-sm text-white/55 hover:text-brand-yellow transition-colors"
                  >
                    Instagram @{contacts.instagram}
                  </a>
                  <a
                    href={`mailto:${contacts.email}`}
                    className="mt-2 flex items-center gap-2 text-sm text-white/45 hover:text-brand-yellow transition-colors"
                  >
                    <Mail size={14} />
                    {contacts.email}
                  </a>
                </div>

                <div className="landing-glass rounded-2xl p-5">
                  <div className="mb-3 flex items-center gap-2 text-brand-amber">
                    <Monitor size={18} />
                    <span className="text-sm font-medium">Формат занятий</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {siteConfig.formats.map((f) => (
                      <span
                        key={f}
                        className="rounded-full border border-yellow-400/20 bg-yellow-400/5 px-3 py-1 text-xs text-brand-yellow"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="landing-glass rounded-2xl p-5">
                  <div className="mb-3 flex items-center gap-2 text-brand-amber">
                    <Clock size={18} />
                    <span className="text-sm font-medium">Режим работы</span>
                  </div>
                  {hours.map((h) => (
                    <div key={h.days} className="flex justify-between gap-4 text-sm">
                      <span className="text-white/55">{h.days}</span>
                      <span className="font-medium text-white">{h.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map */}
              <div className="lg:col-span-3">
                <LocationMap className="h-full min-h-[480px] border border-orange-500/15 shadow-2xl shadow-black/40" />
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="relative overflow-hidden rounded-3xl border border-orange-500/20 bg-gradient-to-br from-[#1a1000] via-[#0f0f0f] to-[#0a0a0a] p-10 text-center md:p-14">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,149,0,0.15),transparent_60%)]" />
            <div className="relative">
              <h2 className="text-3xl font-bold md:text-4xl">
                Готовы <span className="landing-gradient-text">начать обучение</span>?
              </h2>
              <p className="mx-auto mt-4 max-w-md text-white/55">
                Позвоните или напишите нам — расскажем о группах, расписании и стоимости.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <a
                  href={`tel:${contacts.phone.replace(/\s/g, "")}`}
                  className="landing-btn landing-btn-primary landing-btn-lg"
                >
                  <Phone size={18} />
                  {contacts.phone}
                </a>
                <a
                  href={`https://t.me/${contacts.telegram.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-btn landing-btn-outline landing-btn-lg"
                >
                  <MessageCircle size={18} />
                  Написать в Telegram
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-center sm:flex-row sm:text-left">
          <div>
            <p className="font-semibold text-white">{siteConfig.name}</p>
            <p className="mt-1 text-xs text-white/35">
              {location.city}, {location.address}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-white/35">
            <a href={`tel:${contacts.phone.replace(/\s/g, "")}`} className="hover:text-brand-yellow transition-colors">
              {contacts.phone}
            </a>
            <Link href="/login" className="hover:text-brand-yellow transition-colors">
              Вход для учеников и сотрудников
            </Link>
          </div>
          <p className="text-xs text-white/25">
            © {new Date().getFullYear()} {siteConfig.name}
          </p>
        </div>
      </footer>
    </div>
  );
}
