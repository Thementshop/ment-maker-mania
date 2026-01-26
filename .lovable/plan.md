

## Remove Carousel and Display All Sections Horizontally

### What We're Changing

Currently, the homepage has two layouts:
- **Desktop**: 3-column grid (hidden on mobile)
- **Mobile**: Swipeable carousel with dot indicators

We'll replace this with a single horizontal layout that shows all 3 sections side by side on all screen sizes, with the new order you requested.

---

### New Order

| Position | Section |
|----------|---------|
| Left | Kindness Jar |
| Center | Send a Ment |
| Right | Ment Chains |

---

### File to Modify

**`src/pages/Index.tsx`**

Changes:
1. Remove the carousel imports (CarouselDots, Carousel components, CarouselApi type)
2. Remove the `carouselApi` state
3. Replace both the desktop grid and mobile carousel with a single responsive grid
4. Reorder sections: KindnessJar → SendMent → MentChains
5. Make the grid responsive: stack on very small screens, 3 columns on larger screens

---

### New Layout Code

```tsx
<main className="container flex-1 py-6 sm:py-8 pb-24 px-4">
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
    {/* Left: Kindness Jar */}
    <KindnessJarSection 
      jarCount={jarCount} 
      totalSent={totalSent} 
    />
    
    {/* Center: Send a Ment */}
    <SendMentSection 
      onOpenModal={() => setIsModalOpen(true)} 
      totalSent={totalSent} 
    />
    
    {/* Right: Ment Chains */}
    <MentChainsSection />
  </div>
</main>
```

---

### Responsive Behavior

| Screen Size | Layout |
|-------------|--------|
| Mobile (< 768px) | Stacked vertically (all visible, scroll down) |
| Tablet & Desktop (≥ 768px) | 3 columns side by side |

This ensures all sections are always visible without swiping or navigating.

---

### Cleanup

Removing unused code:
- `CarouselDots` import
- `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselApi` imports
- `carouselApi` state variable
- `unwrappedMint` import (appears unused)

