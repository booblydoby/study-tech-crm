export type AvatarId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type AnimalKind = "fox" | "cat" | "dog" | "rabbit" | "bear" | "owl" | "penguin" | "frog";

export const AVATAR_IDS: AvatarId[] = [1, 2, 3, 4, 5, 6, 7, 8];

export interface AvatarOption {
  id: AvatarId;
  label: string;
  animal: AnimalKind;
  image: string;
  ringColor: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 1, label: "Лиса", animal: "fox", image: "/avatars/avatar-fox.png", ringColor: "rgba(255, 149, 0, 0.45)" },
  { id: 2, label: "Кот", animal: "cat", image: "/avatars/avatar-cat.png", ringColor: "rgba(168, 85, 247, 0.45)" },
  { id: 3, label: "Пёс", animal: "dog", image: "/avatars/avatar-dog.png", ringColor: "rgba(99, 102, 241, 0.45)" },
  {
    id: 4,
    label: "Зайка",
    animal: "rabbit",
    image: "/avatars/avatar-rabbit.png",
    ringColor: "rgba(244, 63, 94, 0.45)"
  },
  { id: 5, label: "Мишка", animal: "bear", image: "/avatars/avatar-bear.png", ringColor: "rgba(180, 83, 9, 0.45)" },
  { id: 6, label: "Сова", animal: "owl", image: "/avatars/avatar-owl.png", ringColor: "rgba(16, 185, 129, 0.45)" },
  {
    id: 7,
    label: "Пингвин",
    animal: "penguin",
    image: "/avatars/avatar-penguin.png",
    ringColor: "rgba(100, 116, 139, 0.45)"
  },
  { id: 8, label: "Лягушка", animal: "frog", image: "/avatars/avatar-frog.png", ringColor: "rgba(132, 204, 22, 0.45)" }
];

export function normalizeAvatarId(value: number | null | undefined): AvatarId {
  if (value && value >= 1 && value <= 8) return value as AvatarId;
  return 1;
}

export function getAvatarOption(id: number | null | undefined): AvatarOption {
  return AVATAR_OPTIONS.find((a) => a.id === normalizeAvatarId(id)) ?? AVATAR_OPTIONS[0];
}
