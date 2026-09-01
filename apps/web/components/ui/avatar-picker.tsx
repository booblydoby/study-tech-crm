"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { AVATAR_OPTIONS, AvatarId, normalizeAvatarId } from "@/lib/avatars";

interface AvatarPickerProps {
  value: number;
  onChange: (id: AvatarId) => void;
  label?: string;
  disabled?: boolean;
}

export function AvatarPicker({ value, onChange, label = "Зверёк", disabled }: AvatarPickerProps) {
  const selected = normalizeAvatarId(value);

  return (
    <div>
      {label ? <p className="mb-2 text-sm font-medium text-white/75">{label}</p> : null}
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-4">
        {AVATAR_OPTIONS.map((option) => {
          const active = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.id)}
              title={option.label}
              className={cn(
                "group flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition-all",
                active ? "ring-2 ring-brand-amber/70 ring-offset-2 ring-offset-[#0e0e0e]" : "opacity-85 hover:opacity-100",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              <span
                className="relative block size-14 overflow-hidden rounded-full shadow-md ring-1 ring-white/20"
                style={{ boxShadow: active ? `0 0 0 2px ${option.ringColor}` : undefined }}
              >
                <Image
                  src={option.image}
                  alt={option.label}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              </span>
              <span className="text-[10px] text-white/50">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
