export const spacesByCompany: Record<string, string[]> = {
  "section-a-origami": ["Origami Studio", "Creation Gallery", "Folding Challenges", "Paper & Materials", "Custom Requests", "Workshops"],
  "world-of-tech": ["App Idea Lab", "Build Board", "UI/UX Studio", "Testing Lab", "Bug Hunt", "Launch Center"],
  "world-of-designing": ["Interior Studio", "Room Planner", "Moodboards", "Client Projects", "Company Planner", "Strategy Board"],
  "world-of-colours": ["Art Studio", "Sketchbook", "Painting Projects", "Artwork Gallery", "Creative Challenges", "Portfolio"],
};

export const spaceIcons = ["✨", "🚀", "🎯", "🧩", "🔥", "💡"];

export function spaceNames(slug: string | undefined) {
  return spacesByCompany[slug ?? ""] ?? ["Space 1", "Space 2", "Space 3", "Space 4", "Space 5", "Space 6"];
}

export function spaceIndex(spaceKey: string) {
  const n = Number(spaceKey.replace("space-", ""));
  return Number.isFinite(n) && n >= 1 && n <= 6 ? n - 1 : 0;
}

export function spaceLabel(slug: string | undefined, spaceKey: string) {
  return spaceNames(slug)[spaceIndex(spaceKey)] ?? "Space";
}
