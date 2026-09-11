export const avatarColors = [
  "bg-ping-orange",
  "bg-ping-teal",
  "bg-purple-400",
  "bg-yellow-500",
  "bg-blue-400",
];

export function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function colorFor(name: string | null | undefined): string {
  return avatarColors[(name?.charCodeAt(0) || 0) % avatarColors.length];
}
