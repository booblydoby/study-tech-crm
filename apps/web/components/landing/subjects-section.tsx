"use client";

import { ArrowRight, CheckCircle2, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { siteConfig, type SiteSubject } from "@/lib/site-config";

function SubjectModal({
  subject,
  onClose
}: {
  subject: SiteSubject;
  onClose: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const { contacts } = siteConfig;
  const telegramUrl = `https://t.me/${contacts.telegram.replace("@", "")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="landing-glass-strong relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl shadow-2xl shadow-black/60 sm:rounded-3xl">
        {/* Header */}
        <div className="relative shrink-0 border-b border-white/10 px-6 py-5">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-orange/10 via-brand-yellow/5 to-transparent" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-yellow/25 to-brand-orange/15 text-3xl">
                {subject.emoji}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{subject.name}</h2>
                <p className="mt-1 text-sm text-white/50">{subject.shortDescription}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>

          <div className="relative mt-4 flex flex-wrap gap-2">
            {subject.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-yellow-400/20 bg-yellow-400/5 px-3 py-1 text-xs text-brand-yellow"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-amber">
              Программы обучения
            </h3>
            <div className="space-y-3">
              {subject.programs.map((program) => (
                <div
                  key={program.title}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-orange-500/20 hover:bg-white/[0.05]"
                >
                  <p className="font-medium text-white">{program.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/50">{program.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-brand-amber">
              <Users size={15} />
              Для кого
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {subject.forWhom.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-white/60">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-brand-orange" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 border-t border-white/10 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-white/40">Запишитесь на пробное занятие</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`tel:${contacts.phone.replace(/\s/g, "")}`}
                className="landing-btn landing-btn-outline landing-btn-sm"
              >
                Позвонить
              </a>
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn landing-btn-primary landing-btn-sm"
              >
                Telegram
                <ArrowRight size={13} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubjectsSection() {
  const [active, setActive] = useState<SiteSubject | null>(null);

  return (
    <>
      <div className="grid gap-6 md:grid-cols-3">
        {siteConfig.subjects.map((subject) => (
          <button
            key={subject.id}
            type="button"
            onClick={() => setActive(subject)}
            className="landing-feature-card landing-glass group relative overflow-hidden rounded-3xl p-7 text-left transition-all"
          >
            <div className="absolute -right-4 -top-4 text-7xl opacity-[0.07] transition-transform duration-500 group-hover:scale-110">
              {subject.emoji}
            </div>

            <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-brand-yellow/20 to-brand-orange/10 p-3 transition-transform duration-300 group-hover:scale-110">
              <span className="text-2xl">{subject.emoji}</span>
            </div>

            <h3 className="text-xl font-bold text-white">{subject.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50 line-clamp-3">
              {subject.shortDescription}
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {subject.highlights.map((h) => (
                <span
                  key={h}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/55"
                >
                  {h}
                </span>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-brand-yellow transition-all group-hover:gap-2.5">
              Подробнее
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>

      {active && <SubjectModal subject={active} onClose={() => setActive(null)} />}
    </>
  );
}
