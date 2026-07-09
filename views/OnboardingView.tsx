import React, { useState, useRef } from 'react';
import Screen1 from '../assets/ParQueenScreen1.jpg';
import Screen2 from '../assets/ParQueenScreen2.jpg';
import Screen3 from '../assets/ParQueenScreen3.jpg';

const sections = [
    { image: Screen1, eyebrow: 'THE PROBLEM', headline: 'Still circling the block?', subtext: 'Stop driving in circles looking for parking' },
    { image: Screen2, eyebrow: 'THE SOLUTION', headline: 'Know before it opens up', subtext: 'See shared spots open up near you in real time' },
    { image: Screen3, eyebrow: 'THE COMMUNITY', headline: 'Help your neighbors', subtext: 'Get help from your neighbors, too' },
] as const;

export const OnboardingView = ({ onComplete }: { onComplete: () => void }) => {
    const [current, setCurrent] = useState(0);
    const [animating, setAnimating] = useState(false);
    const touchStartX = useRef<number | null>(null);

    const goTo = (index: number) => {
        if (animating || index === current) return;
        setAnimating(true);
        setCurrent(index);
        setTimeout(() => setAnimating(false), 400);
    };

    const advance = () => goTo(Math.min(current + 1, sections.length - 1));
    const goBack = () => goTo(Math.max(current - 1, 0));

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (dx < -40) advance();
        else if (dx > 40) goBack();
    };

    return (
        <div
            className="h-full w-full relative select-none overflow-hidden"
            onClick={advance}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {sections.map((s, i) => (
                <div
                    key={i}
                    className="absolute inset-0"
                    style={{
                        transform: i === current ? 'translateX(0)' :
                            i < current ? 'translateX(-100%)' : 'translateX(100%)',
                        transitionDuration: '400ms',
                        transitionProperty: 'transform',
                        transitionTimingFunction: 'ease-out',
                    }}
                >
                    <img
                        src={s.image}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        draggable={false}
                    />

                    <div
                        className="absolute inset-x-0 bottom-0 flex flex-col justify-end px-7 pb-14"
                        style={{
                            height: '60%',
                            background: 'linear-gradient(to bottom, transparent 0%, #07162c 75%)',
                        }}
                    >
                        <span className="text-[10px] font-bold tracking-[0.2em] text-blue-400/80 uppercase mb-2">
                            {s.eyebrow}
                        </span>
                        <h2 className="text-[22px] leading-tight font-bold text-[var(--color-text)] mb-1.5">
                            {s.headline}
                        </h2>
                        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                            {s.subtext}
                        </p>

                        {i === sections.length - 1 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onComplete(); }}
                                className="mt-6 w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 active:scale-[0.98] text-white font-bold py-3.5 rounded-full text-sm shadow-lg shadow-blue-500/30 transition-all"
                            >
                                Get Started
                            </button>
                        )}
                    </div>
                </div>
            ))}

            <div className="absolute bottom-0 inset-x-0 flex justify-center gap-2 pb-5">
                {sections.map((_, i) => (
                    <button
                        key={i}
                        aria-label={`Go to slide ${i + 1}`}
                        onClick={(e) => { e.stopPropagation(); goTo(i); }}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                            i === current
                                ? 'w-6 bg-blue-500'
                                : 'w-1.5 bg-white/25'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
};
