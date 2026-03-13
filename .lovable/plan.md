

## Phase 2: Email Templates + Category Tracking

### Summary
Add `compliment_category` tracking to the database and chain creation flow, then build all 4 email templates (chain_received teaser, 1hr warning single/batched, milestone, completed) with category-based subject lines.

Note: The Affirmation category already exists in `src/data/compliments.ts` from a previous change, so that part is done.

---

### 1. Database Migration — Add `compliment_category` columns

Add nullable `compliment_category TEXT` column to both `ment_chains` and `chain_links` tables, plus indexes for analytics.

---

### 2. Update `create-chain` Edge Function

- Accept `complimentCategory` in the request body
- Store it in `ment_chains.compliment_category` on insert
- Store it in each `chain_links` entry on insert
- After chain creation, fire-and-forget call to `send-email` for each email-type recipient (only those with `@` in their value), passing the category and compliment text

**`StartChainModal.tsx`** — pass `complimentCategory: selectedCategory.id` in the fetch body alongside `chainName`, `recipients`, `compliment`.

---

### 3. Rewrite `send-email` Edge Function

Replace the single template with a full template system supporting all 4 email types:

**Request interface** — expand `template_data` to include optional fields: `compliment_category`, `compliment_text`, `milestone`, `total_shares`, `tier_status`, `share_url`, `app_url`, `urgent_chain_name`, `urgent_time_left`, `urgent_chain_url`, `other_chains[]`, `compliments[]`, `count`.

**Category-based subjects for `chain_received`:**
```
love → "❤️ Someone loves you!"
encouragement → "💪 Someone believes in you!"
sympathy → "💙 Someone is thinking of you"
special → "🎉 Someone's celebrating you!"
funny → "😄 Someone made you smile!"
affirmation → "✨ Someone sees your light!"
default → "💚 You received a kindness chain!"
```

**Template #1 — `chain_received` (TEASER, no compliment shown):**
- Gift box icon with "Your compliment is waiting..." teaser
- "Reveal Your Compliment →" CTA button
- 24-hour reminder callout
- "What is Ment Shop?" explainer section

**Template #2a — `1hr_warning` (single chain):**
- Warning header with timer icon
- Chain name and "Pass It Forward →" CTA
- Pause token tip

**Template #2b — `1hr_warning` (batched, multiple chains):**
- Rendered when `template_data.other_chains` array is present
- Most urgent chain highlighted at top
- Other chains listed below
- "View All Your Chains →" CTA

**Template #3 — `milestone`:**
- Subject: `🎉 Your "{{chain_name}}" chain hit {{milestone}} shares!`
- Celebration header with confetti emoji
- Chain stats (total shares, tier status)
- "View Chain History" + "Share This Achievement" CTAs
- Hashtag footer

**Template #4 — `completed`:**
- Subject: `Your "{{chain_name}}" chain completed! 💚`
- Lists all compliments from the chain with sender names
- Total shares summary
- "Start Another Chain →" CTA

All templates use inline styles, 600px max-width, brand colors (#22c55e, #f0fdf4), and include the standard footer with contact tip.

---

### 4. Update `test-email` Edge Function

Update test data to include `compliment_category: 'encouragement'` and remove `compliment_text` (teaser approach). Add ability to test other email types via query param.

---

### Files Changed
- **Migration SQL** — add `compliment_category` to `ment_chains` and `chain_links`
- **`supabase/functions/create-chain/index.ts`** — accept & store category, trigger email
- **`supabase/functions/send-email/index.ts`** — full rewrite with 4 templates + category subjects
- **`supabase/functions/test-email/index.ts`** — update test data
- **`src/components/chains/StartChainModal.tsx`** — pass `complimentCategory` in request body

