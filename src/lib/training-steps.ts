// Single source of truth for the training tours. driver.js Training Mode reads
// these today; a future Help tab can render the same content. One action per
// step, plain low-literacy wording. A step with no `element` is a screen intro
// (centered popover, no highlight).

export interface TrainingStep {
  element?: string; // CSS selector for the highlighted element; omit for an intro step
  title: string;
  body: string;
}

export const TRAINING_STEPS: Record<string, TrainingStep[]> = {
  // ── Pearl ───────────────────────────────────────────────────────────────
  pearl_home: [
    {
      element: '[data-tour="budget-card"]',
      title: "What's left to spend",
      body: "This is what's left to spend this month.",
    },
    {
      element: '[data-tour="accounts"]',
      title: "Two accounts",
      body: "Your money is in two accounts — FNB and Stanbic. They are shown separately.",
    },
    {
      element: '[data-tour="envelope-first"]',
      title: "Pace each week",
      body: "Each line shows your weekly amount, so it is easy to pace your spending.",
    },
    {
      element: '[data-tour="add-receipt"]',
      title: "Add a receipt",
      body: "Tap Add any time you spend money.",
    },
  ],

  // The most important tour — thorough, one action per step.
  add_receipt: [
    {
      element: '[data-tour="amount"]',
      title: "When you spend, tap here",
      body: "Tap here and type the amount in Pula. Just the number.",
    },
    {
      element: '[data-tour="envelope-pick"]',
      title: "Pick what it was for",
      body: "Tap what you spent on. These are your budgets — groceries, lunch, fuel and more.",
    },
    {
      element: '[data-tour="photo"]',
      title: "Snap the receipt",
      body: "Take a photo of the receipt, or upload one. It is for the records, and it works with no signal.",
    },
    {
      element: '[data-tour="note"]',
      title: "Add a note",
      body: "You can add the shop name, like Choppies. This part is optional.",
    },
    {
      element: '[data-tour="save"]',
      title: "Tap Save — that's it",
      body: "Save works even with no internet. It syncs by itself later, so you never lose a receipt.",
    },
  ],

  pearl_report: [
    {
      element: '[data-tour="summary"]',
      title: "Your month",
      body: "This shows what the home spent this month.",
    },
    {
      element: '[data-tour="export"]',
      title: "Share the report",
      body: "Tap here to save or share the month's report.",
    },
  ],

  // ── Terence ─────────────────────────────────────────────────────────────
  terence_home: [
    {
      title: "Your home screen",
      body: "This screen shows the whole month at a glance — Pearl's spending and your fixed costs.",
    },
    {
      element: '[data-tour="budget-card"]',
      title: "Pearl's budget",
      body: "Pearl's running budget — what she has left to spend this month.",
    },
    {
      element: '[data-tour="fixed-card"]',
      title: "Your fixed layer",
      body: "Your fixed costs — rent, madressa, and the school buffer you manage.",
    },
  ],

  terence_add: [
    {
      title: "Adding a receipt",
      body: "You can log a receipt here too, the same way Pearl does.",
    },
    {
      element: '[data-tour="amount"]',
      title: "The amount",
      body: "Type the amount in Pula.",
    },
    {
      element: '[data-tour="save"]',
      title: "Save",
      body: "Tap Save. It works offline and syncs later.",
    },
  ],

  terence_report: [
    {
      title: "The monthly report",
      body: "This is the month's summary for the books.",
    },
    {
      element: '[data-tour="export"]',
      title: "Send to Hope",
      body: "Tap here to export the month and send it to Hope, the accountant.",
    },
  ],

  terence_manage: [
    {
      title: "Managing budgets",
      body: "This is where you set the budgets and run the month.",
    },
    {
      element: '[data-tour="budgets"]',
      title: "Edit budgets",
      body: "Change each budget, weeks or base here. Tap an account chip to move a line.",
    },
    {
      element: '[data-tour="new-month"]',
      title: "Start a new month",
      body: "When the month ends, start a new one. It saves the old month and resets spending.",
    },
  ],
};

export type TourId = keyof typeof TRAINING_STEPS;

// Accent palette for the trainer (spec §5).
export const TRAINER_ACCENT = "#16365C";
export const TRAINER_DARK = "#0F2540";
