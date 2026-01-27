
# Update Pause Token UI Text

## Summary
The pause token logic already correctly resets the countdown to 24 hours (not adding to remaining time). The only change needed is to update the toast message in ChainCard.tsx to clarify the "reset" behavior rather than implying it "adds" time.

## Changes Required

### 1. Update Toast Message in ChainCard.tsx
**File**: `src/components/chains/ChainCard.tsx`

Update the toast description from:
- Current: `"+24 hours added to this chain"`
- New: `"Timer reset to 24 hours"`

This clarifies that using a token resets the countdown to a full 24 hours, rather than adding time to whatever is remaining.

### 2. Remove pricePerToken from TokenPackage (Optional Cleanup)
**File**: `src/pages/Store.tsx`

Since the `pricePerToken` field is defined but never displayed, we can optionally remove it from the interface and package definitions for cleaner code:
- Remove `pricePerToken` from the `TokenPackage` interface
- Remove `pricePerToken` values from all three package objects

## Technical Notes
- The core logic in `usePauseTokens.ts` is already correct - it creates a new Date and adds exactly 24 hours from NOW
- The Store page info section already has the correct wording ("resets your chain's countdown back to 24 hours")
- No database changes required

## Result
Users will have consistent messaging that clearly communicates pause tokens reset the timer to 24 hours, not add time to the remaining countdown.
