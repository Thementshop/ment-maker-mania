import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { CarouselApi } from '@/components/ui/carousel';

interface CarouselDotsProps {
  api: CarouselApi | undefined;
  count: number;
  className?: string;
}

const CarouselDots = ({ api, count, className }: CarouselDotsProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!api) return;

    setCurrentSlide(api.selectedScrollSnap());
    
    const onSelect = () => {
      setCurrentSlide(api.selectedScrollSnap());
    };

    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  const handleDotClick = (index: number) => {
    if (api) {
      api.scrollTo(index);
    }
  };

  return (
    <div className={cn('flex justify-center gap-2 py-4', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <button
          key={index}
          onClick={() => handleDotClick(index)}
          className={cn(
            'h-2.5 w-2.5 rounded-full transition-all duration-300',
            index === currentSlide
              ? 'bg-primary scale-125'
              : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
          )}
          aria-label={`Go to slide ${index + 1}`}
        />
      ))}
    </div>
  );
};

export default CarouselDots;
