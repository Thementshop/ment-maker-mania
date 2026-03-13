

## Plan: Add Affirmation Category to Compliments

Add a new "Affirmation" category as the 6th entry in the `complimentCategories` array in `src/data/compliments.ts`.

### Changes

**`src/data/compliments.ts`** — Append new category object after the "Funny/Slang" entry:
- `id: 'affirmation'`
- `name: 'Affirmation'`
- `emoji: '✨'`
- `gradient: 'candy-card-affirmation'`
- All 20 compliments as provided

**`src/index.css`** (or `tailwind.config.ts`) — Add the `candy-card-affirmation` gradient class with warm/soft colors similar to the love category. Need to check where existing gradients like `candy-card-love` are defined.

