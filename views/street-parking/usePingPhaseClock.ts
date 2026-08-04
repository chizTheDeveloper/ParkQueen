import { useEffect, useRef, useState } from 'react';
import { createPingPhaseClock, PingTiming } from '../../utils/pingLifecycle';

export function usePingPhaseClock(items: PingTiming[]): number {
  const [nowMs, setNowMs] = useState(Date.now);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const clock = createPingPhaseClock({
      getItems: () => itemsRef.current,
      onTick: setNowMs,
    });
    const resume = () => clock.resume();
    const resumeWhenVisible = () => {
      if (document.visibilityState === 'visible') clock.resume();
    };

    clock.start();
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resumeWhenVisible);
    return () => {
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resumeWhenVisible);
      clock.stop();
    };
  }, [items]);

  return nowMs;
}
