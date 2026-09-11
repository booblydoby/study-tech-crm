import Image from "next/image";
import { cn } from "@/lib/utils";
import { getAvatarOption } from "@/lib/avatars";

interface AvatarProps {
  avatarId?: number | null;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { box: "size-8", px: 32 },
  md: { box: "size-10", px: 40 },
  lg: { box: "size-14", px: 56 }
};

export function Avatar({ avatarId, name, size = "md", className }: AvatarProps) {
  const option = getAvatarOption(avatarId);
  const dim = sizes[size];
  const initial = name?.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      title={name ? `${name} · ${option.label}` : option.label}
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full shadow-md ring-1 ring-white/15",
        dim.box,
        className
      )}
      style={{ boxShadow: `0 0 0 1px ${option.ringColor}` }}
    >
      <Image src={option.image} alt={option.label} width={dim.px} height={dim.px} className="size-full object-cover" />
      <span className="sr-only">{initial}</span>
    </div>
  );
}
