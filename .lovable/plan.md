## Rewrite "How The Ment Shop Works" Modal

Update the steps array in `src/components/HowItWorksModal.tsx` to reflect accurate app mechanics. Seven steps total.

### New Step Content

**1. Collect Ments** (icon: unwrapped mint image)
- "Start your journey with 25 mints in your jar. Earn 1 extra mint every time you send a compli-ment to brighten someone's day."

**2. Send a Compli-Ment** (icon: Send)
- "Pick from our library of uplifting compliments — or write your own — and send it to anyone via email or text. Each send adds a mint to your jar."

**3. Start a Chain** (icon: wrapped mint image, replacing "Watch Them Unwrap")
- "Send one compliment to up to 3 people and challenge them to pass it forward within 24 hours. Watch your kindness ripple across the world — every link earns mints for everyone involved."

**4. Receiving a Ment** (NEW — icon: Heart from lucide-react)
- "When someone sends you a ment, you'll get an email or text with a link to unwrap it. Savor your moment — then send one back or pass it along to keep the kindness flowing."

**5. Pause Tokens** (NEW — icon: Clock or Pause from lucide-react, mint color)
- "Running low on time? Use a Pause Token to reset a chain's 24-hour timer and keep the kindness alive. You start with 3 tokens — earn or buy more in the store."

**6. Level Up** (Trophy icon — unchanged copy)

**7. Join the Movement** (Globe icon — unchanged copy)

### Technical Notes

- Single-file change: `src/components/HowItWorksModal.tsx`
- Update only the `steps` array; modal layout, animations, header, footer untouched
- Add `Heart` (already imported) and `Pause` to lucide-react imports as needed
