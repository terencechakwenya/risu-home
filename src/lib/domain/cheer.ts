// Warm, encouraging microcopy for Pearl's view. Rewards good behaviour only —
// logging and staying under budget. Never clinical, never guilt-trippy.

const SAVED_LINES = [
  "Nice one!",
  "Logged it! 🙌",
  "Well done!",
  "Boom — saved!",
  "You're on it!",
  "Great habit!",
];

export function savedCheer(): string {
  return SAVED_LINES[(Math.random() * SAVED_LINES.length) | 0];
}

export const FIRST_RECEIPT_TITLE = "Your very first receipt! 🎉";
export const FIRST_RECEIPT_BODY =
  "You've started the habit that keeps the home on budget. This is a big one.";

// Pacing line for the home hero, based on how much of the budget is spent.
export function pacingMessage(spent: number, budget: number): string {
  if (budget <= 0) return "Let's get going!";
  const r = spent / budget;
  if (r < 0.5) return "You're pacing well this week 👏";
  if (r < 0.8) return "Looking good — keep it steady.";
  if (r <= 1) return "Getting close — ease off a little.";
  return "A little over — next week is a fresh start.";
}

// Friendly line for the report summary when the month is under budget.
export function reportCheer(under: number): string {
  if (under > 0) return `Amazing — you saved ${"P " + Math.round(under).toLocaleString()} this month! ✨`;
  if (under === 0) return "Right on budget — well managed!";
  return "So close — every receipt you log helps next month.";
}
