

## Recreate Candy Jar Fill - Plan

### Problem
The current implementation uses tiny 8px mints in a narrow 54x55px container with limited rotation, resulting in mints that don't look like naturally settled candy. The z-ordering also causes visibility issues.

### Approach
Rewrite the jar display section of `MintJar.tsx` based on the user's provided implementation pattern:

**File: `src/components/MintJar.tsx`**

1. **Z-order fix**: Render mints BEHIND the jar glass (z-0) with jar on top (z-10), badge at z-20. This lets the glass overlay create the "seen through glass" effect naturally.

2. **Larger container**: Replace the tiny 54x55px interior box with a ~140x180px centered container positioned with `left: 50%; transform: translateX(-50%)` and `bottom: 50px`.

3. **Bigger mints**: Increase from 8px to 22px so they're actually visible and match the reference.

4. **New positioning algorithm**:
   - 7 mints per layer, 16px layer height
   - Percentage-based X positioning (`(seed * 37) % 100`)
   - Full 360° rotation (`(seed * 47) % 360`)
   - Scale range 0.85-1.15
   - Random Y jitter per mint for natural settling

5. **Drop shadows**: Add `filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2))` to each mint.

6. **Remove motion animations on individual mints** - use simple CSS transitions (`transition-all duration-500 ease-out`) instead of framer-motion per mint for better performance.

7. **Keep everything else**: Title, count display, level progress, tier progress, tier-up celebration modal all stay unchanged.

### Technical Details
- Only `src/components/MintJar.tsx` needs changes (lines ~58-156)
- Container wrapper grows from 224x240 to 224x260 to accommodate taller fill
- Cap remains at 60 mints for performance
- Only uses `/images/mint-candy.png` - no mixed candy types

