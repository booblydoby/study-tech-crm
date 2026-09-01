import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-0 bg-gradient-to-b from-[#ffcc00] to-[#ff8a00] text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(255,138,0,0.28)] hover:from-[#ffd60a] hover:to-[#ff9500] hover:-translate-y-px",
        outline:
          "border border-yellow-400/25 bg-white/5 text-white/90 hover:border-yellow-400/45 hover:bg-yellow-400/8 hover:text-brand-yellow",
        ghost: "text-white/70 hover:bg-white/8 hover:text-white"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant }), className)} {...props} />;
}
