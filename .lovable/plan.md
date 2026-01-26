

## Fix `last_free_token_date` Column Constraint

### Overview
Make the `last_free_token_date` column NOT NULL to ensure data integrity for the free token eligibility system.

### Current State
- Column is **nullable** with a default of `now()`
- No existing rows have NULL values (verified)
- The `handle_new_user()` trigger already sets this on signup

### Why This Matters
The free token system checks if 7+ days have passed since `last_free_token_date`. Having this column always populated ensures:
- Reliable eligibility calculations
- Simpler query logic (no COALESCE needed)
- Better data consistency

---

## Implementation Steps

### Step 1: Database Migration
Run a migration to alter the column constraint:

```sql
ALTER TABLE user_game_state 
ALTER COLUMN last_free_token_date SET NOT NULL;
```

### Step 2: Verify the Change
After migration, confirm the schema change was applied successfully.

---

## Technical Details

**Risk Assessment**: Low
- No existing NULL values in the database
- Default value (`now()`) is already set
- The `handle_new_user()` trigger handles new user creation

**Code Impact**: None required
- The `usePauseTokens.ts` hook already handles this gracefully
- TypeScript types will automatically update after migration

**Migration Safety**:
- Migration will succeed since no rows have NULL values
- Future inserts will require a value or use the default

