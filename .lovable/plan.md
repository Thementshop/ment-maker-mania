

## Homepage Layout Redesign with Ment Chains

### Overview
Transform the homepage into a responsive 3-section layout that works as a grid on desktop and a swipeable carousel on mobile.

```text
Desktop (lg: and above)
+------------------+------------------+------------------+
|   Send a Ment    |   Kindness Jar   |   Ment Chains    |
|                  |                  |                  |
|  [MintButton     |  [SimplifiedJar] |  [Chain Preview  |
|   + Sent Count]  |                  |   with image]    |
+------------------+------------------+------------------+

Mobile (swipeable carousel with dots)
<--[ Send a Ment ]-->  <--[ Kindness Jar ]-->  <--[ Ment Chains ]-->
            ● ○ ○              ○ ● ○                 ○ ○ ●
```

---

### Files to Create

| File | Description |
|------|-------------|
| `src/components/SimplifiedJar.tsx` | Stats-only jar display with level progress |
| `src/components/MentChains.tsx` | Chain preview using the provided image as background |
| `src/components/CarouselDots.tsx` | Dot navigation indicators for mobile |
| `src/components/home/SendMentSection.tsx` | Card wrapper for Send a Ment |
| `src/components/home/KindnessJarSection.tsx` | Card wrapper for Kindness Jar |
| `src/components/home/MentChainsSection.tsx` | Card wrapper for Ment Chains |
| `src/assets/ment-chain-bg.png` | Copy the uploaded chain image to assets |

### File to Modify

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Replace current layout with responsive grid/carousel |

---

### Component Details

**1. SimplifiedJar Component**
A clean, text-based stats display (no jar image, no animations):

```text
+--------------------------------+
|        Kindness Jar            |
|                                |
|           247                  |
|    Total Ments Collected       |
|                                |
|  Level 4: Senti-Mental         |
|  [=========>          ] 68%    |
|   32 ments to Level 5          |
|                                |
| [Customize Jar (Coming Soon)]  |
+--------------------------------+
```

Data sources:
- `jarCount` from game store = Total Ments Collected
- `getCurrentLevel(totalSent)` = Current level name
- `getLevelProgress(totalSent)` = Progress bar percentage
- `getMentsToNextLevel(totalSent)` = Ments remaining

**2. MentChains Component**
Uses the uploaded image as a decorative background with overlay data:

```text
+--------------------------------+
|  🔥 Ment Chain                 |
|                                |
|  [Chain bracelet image with    |
|   mint candies background]     |
|                                |
|  🔥 Don't Break The Chain!     |
|                                |
|     Coming Soon                |
|  Start chain reactions of      |
|  kindness with your friends!   |
|                                |
+--------------------------------+
```

The image will be used as a background/decorative element with:
- Semi-transparent overlay for readability
- "Coming Soon" messaging
- Brief description of the feature concept

**3. CarouselDots Component**
Interactive dot indicators synced with Embla carousel:
- 3 dots for 3 sections
- Active dot highlighted in mint green
- Tappable to navigate to specific slide
- Uses `embla.selectedScrollSnap()` for tracking

---

### Technical Implementation

**Index.tsx Layout Structure:**

```tsx
{/* Desktop: 3-column grid */}
<div className="hidden lg:grid lg:grid-cols-3 lg:gap-6">
  <SendMentSection onOpenModal={() => setIsModalOpen(true)} totalSent={totalSent} />
  <KindnessJarSection jarCount={jarCount} totalSent={totalSent} />
  <MentChainsSection />
</div>

{/* Mobile: Swipeable carousel */}
<div className="lg:hidden">
  <Carousel setApi={setApi}>
    <CarouselContent>
      <CarouselItem><SendMentSection ... /></CarouselItem>
      <CarouselItem><KindnessJarSection ... /></CarouselItem>
      <CarouselItem><MentChainsSection /></CarouselItem>
    </CarouselContent>
  </Carousel>
  <CarouselDots api={api} count={3} />
</div>
```

**Carousel State Management:**
```tsx
const [api, setApi] = useState<CarouselApi>();
const [currentSlide, setCurrentSlide] = useState(0);

useEffect(() => {
  if (!api) return;
  setCurrentSlide(api.selectedScrollSnap());
  api.on('select', () => setCurrentSlide(api.selectedScrollSnap()));
}, [api]);
```

---

### Section Card Styling

Each section will be wrapped in a consistent card style:

```tsx
<motion.div className="bg-card rounded-2xl p-6 shadow-lg border border-border h-full flex flex-col items-center justify-center">
  {/* Section content */}
</motion.div>
```

---

### What Stays the Same
- Header component with world counter
- Footer component
- Banner image at top
- SendMentModal (triggered from SendMentSection)
- LevelUpModal (triggered after sending ment)
- All authentication logic
- All database connections
- Game store logic

### What Gets Removed from Index.tsx
- Direct usage of `GlassJar` component (replaced by SimplifiedJar)
- Direct usage of `LevelBadge` component (integrated into SimplifiedJar)
- `InspirationalQuote` component (can be added back later if desired)
- Current two-column flex layout

---

### Asset Handling
The uploaded Ment Chain image will be:
1. Copied to `src/assets/ment-chain-bg.png`
2. Imported in MentChains.tsx as an ES6 module
3. Used as a decorative background with appropriate overlay

---

### Implementation Order

1. Copy the chain image to assets folder
2. Create `CarouselDots.tsx` - reusable dot indicator
3. Create `SimplifiedJar.tsx` - stats-only display
4. Create `MentChains.tsx` - placeholder with image background
5. Create section wrapper components in `src/components/home/`
6. Update `Index.tsx` with new responsive layout

