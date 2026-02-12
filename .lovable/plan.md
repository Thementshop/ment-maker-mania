

# Add Countdown Timer to Public Chain Landing Page

## Problem

The `/chain/:chainId` public view is missing the countdown timer entirely. The timer component and urgency logic already exist in the file and work correctly for the "Current Holder" and "Starter" views, but were never included in the "Public/Participant View" section (the fallback view at the bottom of the component).

## Solution

Add the countdown timer block to the Public/Participant View, placed prominently between the chain name and the stats section. This reuses the existing `countdown` and `urgency` variables already computed at the top of the component.

## Changes

### File: `src/pages/ChainPage.tsx`

Insert a countdown timer block in the Public/Participant View (after the chain name, before the stats), approximately between lines 344 and 347:

```tsx
{/* Countdown Timer */}
<motion.div 
  className={`${urgency.bg} rounded-2xl p-6 ${urgency.animate ? 'animate-pulse' : ''}`}
  animate={urgency.animate ? { scale: [1, 1.02, 1] } : {}}
  transition={{ repeat: Infinity, duration: 1 }}
>
  <p className="text-sm text-muted-foreground mb-2">TIME REMAINING</p>
  <p className={`text-4xl font-mono font-bold ${urgency.color}`}>
    {urgency.icon} {countdown.formattedTime}
  </p>
  {countdown.hours < 2 && (
    <p className="text-sm text-red-500 mt-2 flex items-center justify-center gap-1">
      <Flame className="h-4 w-4" />
      Don't let the chain break!
    </p>
  )}
</motion.div>
```

This is essentially the same timer block used in the Current Holder view, slightly smaller (`text-4xl` instead of `text-5xl`, `p-6` instead of `p-8`) since it's a secondary view. All urgency color-coding (green/yellow/orange/red) and pulse animations will work identically since they use the same `urgency` and `countdown` variables already computed.

No new imports or hooks needed -- everything is already in place.

## Files to Modify

1. `src/pages/ChainPage.tsx` -- add timer block to public view section

