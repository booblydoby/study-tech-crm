"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, CalendarDays, GraduationCap, Lock, Mail, Sparkles } from "lucide-react";
import { AmbientBackground } from "@/components/landing/ambient-background";
import { ApiError } from "@/lib/api-error";
import { clearSession, homeForRole, login } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(email, password);
      window.location.href = user ? homeForRole(user.role) : "/";
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof TypeError) {
        setError("Сервер не отвечает. Попробуйте позже или свяжитесь с центром.");
      } else {
        setError("Не удалось войти. Проверьте логин и пароль.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <AmbientBackground />

      {/* Left branding panel — desktop only */}
      <aside className="relative z-10 hidden w-[45%] flex-col justify-between border-r border-white/5 p-10 lg:flex">
        <div className="animate-fade-up">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white/80"
          >
            <ArrowLeft size={16} />
            На главную
          </Link>
        </div>

        <div className="animate-fade-up-delay-1">
          <div className="mb-8 inline-flex rounded-2xl bg-gradient-to-br from-brand-yellow via-brand-amber to-brand-orange p-4 shadow-lg shadow-orange-500/30">
            <GraduationCap size={36} className="text-[#0a0a0a]" />
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Личный кабинет <span className="landing-gradient-text">Study Tech</span>
          </h1>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-white/55">
            Здесь вы можете следить за расписанием, посещаемостью и своим прогрессом в учебном центре.
          </p>

          <div className="mt-10 space-y-3">
            {[
              { icon: CalendarDays, text: "Расписание ваших занятий" },
              { icon: Sparkles, text: "Посещаемость и прогресс" },
              { icon: Mail, text: "Информация об оплатах" }
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-white/50">
                <Icon size={14} className="shrink-0 text-brand-amber" />
                {text}
              </div>
            ))}
          </div>
        </div>

        <p className="animate-fade-up-delay-2 text-xs text-white/25">© {new Date().getFullYear()} Study Tech</p>
      </aside>

      {/* Right — login form */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="animate-fade-up w-full max-w-md lg:animate-fade-up-delay-1">
          {/* Mobile header */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/70">
              <ArrowLeft size={14} />
              На главную
            </Link>
            <div className="mb-4 inline-flex rounded-2xl bg-gradient-to-br from-brand-yellow via-brand-amber to-brand-orange p-3 shadow-lg shadow-orange-500/25">
              <GraduationCap size={28} className="text-[#0a0a0a]" />
            </div>
            <h1 className="text-2xl font-bold">
              Личный кабинет <span className="landing-gradient-text">Study Tech</span>
            </h1>
            <p className="mt-2 text-sm text-white/45">Расписание, посещаемость и оплаты</p>
          </div>

          <div className="landing-glass-strong rounded-3xl p-8 shadow-2xl shadow-black/40">
            <div className="hidden lg:block">
              <h2 className="text-2xl font-bold">Вход</h2>
              <p className="mt-1 text-sm text-white/45">Используйте логин и пароль, которые вы получили при записи</p>
            </div>

            <form className="mt-6 space-y-5 lg:mt-8" onSubmit={onSubmit}>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-white/50">
                  <Mail size={13} />
                  Логин
                </label>
                <input
                  type="text"
                  placeholder="Ваш логин или email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="landing-input"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-white/50">
                  <Lock size={13} />
                  Пароль
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="landing-input"
                  autoComplete="current-password"
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="landing-btn landing-btn-primary landing-btn-md landing-btn-block"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a]" />
                    Вход...
                  </span>
                ) : (
                  "Войти"
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-white/35">
              Нет доступа?{" "}
              <Link
                href="/#contacts"
                className="text-brand-yellow/80 underline-offset-2 hover:text-brand-yellow hover:underline"
              >
                Свяжитесь с центром
              </Link>
            </p>

            <button
              type="button"
              onClick={() => {
                clearSession();
                setError("Сессия очищена. Войдите снова.");
              }}
              className="mt-3 w-full text-xs text-white/25 underline transition-colors hover:text-white/45"
            >
              Очистить сохранённую сессию
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
