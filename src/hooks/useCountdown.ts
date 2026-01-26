import { useState, useEffect, useCallback, useRef } from 'react';

export interface CountdownResult {
  timeLeft: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  formattedTime: string;
  percentageRemaining: number;
}

interface UseCountdownOptions {
  onExpire?: () => void;
  updateInterval?: number;
}

export const useCountdown = (
  expiresAt: Date | string | null,
  totalDurationMs?: number,
  options: UseCountdownOptions = {}
): CountdownResult => {
  const { onExpire, updateInterval = 1000 } = options;
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  // Keep the callback ref updated
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const calculateTimeLeft = useCallback((): CountdownResult => {
    if (!expiresAt) {
      return {
        timeLeft: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
        formattedTime: '00:00:00',
        percentageRemaining: 0
      };
    }

    const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    const now = new Date();
    const timeLeft = Math.max(0, expiryDate.getTime() - now.getTime());
    const isExpired = timeLeft <= 0;

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    const formattedTime = [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].join(':');

    const percentageRemaining = totalDurationMs 
      ? Math.min(100, Math.max(0, (timeLeft / totalDurationMs) * 100))
      : 0;

    return {
      timeLeft,
      hours,
      minutes,
      seconds,
      isExpired,
      formattedTime,
      percentageRemaining
    };
  }, [expiresAt, totalDurationMs]);

  const [countdown, setCountdown] = useState<CountdownResult>(calculateTimeLeft);

  useEffect(() => {
    // Reset expired flag when expiresAt changes
    hasExpiredRef.current = false;
    setCountdown(calculateTimeLeft());
  }, [expiresAt, calculateTimeLeft]);

  useEffect(() => {
    if (!expiresAt) return;

    const intervalId = setInterval(() => {
      const newCountdown = calculateTimeLeft();
      setCountdown(newCountdown);

      // Call onExpire only once when the countdown expires
      if (newCountdown.isExpired && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current?.();
      }
    }, updateInterval);

    return () => clearInterval(intervalId);
  }, [expiresAt, calculateTimeLeft, updateInterval]);

  return countdown;
};

// Helper hook for multiple countdowns
export const useMultipleCountdowns = (
  items: Array<{ id: string; expiresAt: Date | string | null; totalDurationMs?: number }>
): Map<string, CountdownResult> => {
  const [countdowns, setCountdowns] = useState<Map<string, CountdownResult>>(new Map());

  useEffect(() => {
    const calculateAll = () => {
      const newCountdowns = new Map<string, CountdownResult>();
      
      items.forEach(item => {
        if (!item.expiresAt) {
          newCountdowns.set(item.id, {
            timeLeft: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
            isExpired: true,
            formattedTime: '00:00:00',
            percentageRemaining: 0
          });
          return;
        }

        const expiryDate = typeof item.expiresAt === 'string' 
          ? new Date(item.expiresAt) 
          : item.expiresAt;
        const now = new Date();
        const timeLeft = Math.max(0, expiryDate.getTime() - now.getTime());
        const isExpired = timeLeft <= 0;

        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        const formattedTime = [
          hours.toString().padStart(2, '0'),
          minutes.toString().padStart(2, '0'),
          seconds.toString().padStart(2, '0')
        ].join(':');

        const percentageRemaining = item.totalDurationMs 
          ? Math.min(100, Math.max(0, (timeLeft / item.totalDurationMs) * 100))
          : 0;

        newCountdowns.set(item.id, {
          timeLeft,
          hours,
          minutes,
          seconds,
          isExpired,
          formattedTime,
          percentageRemaining
        });
      });

      setCountdowns(newCountdowns);
    };

    calculateAll();
    const intervalId = setInterval(calculateAll, 1000);

    return () => clearInterval(intervalId);
  }, [items]);

  return countdowns;
};
