import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { ALLOWED_COUNTRIES } from '../utils/phone';
import type { CountryCode } from '../utils/phone';
import { t, useLang, getLang } from '../i18n';

interface CountrySelectorProps {
    selected: CountryCode;
    onChange: (country: CountryCode) => void;
}

/** Flat SVG flag with ISO-code text fallback on load error. */
function FlagImg({ code, size }: { code: string; size: 'sm' | 'md' }) {
    const [err, setErr] = useState(false);
    const w = size === 'sm' ? 22 : 27;
    const h = size === 'sm' ? 15 : 18;
    if (err) {
        return (
            <span
                className="flex items-center justify-center rounded-[3px] shrink-0"
                style={{
                    width: w, height: h,
                    background: 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                }}
                aria-hidden="true"
            >
                {code}
            </span>
        );
    }
    return (
        <img
            src={`/flags/${code.toLowerCase()}.svg`}
            alt=""
            aria-hidden="true"
            width={w}
            height={h}
            onError={() => setErr(true)}
            className="shrink-0 rounded-[3px]"
            style={{ objectFit: 'cover', border: '0.5px solid rgba(255,255,255,0.18)' }}
        />
    );
}

const reduced = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const CountrySelector: React.FC<CountrySelectorProps> = ({ selected, onChange }) => {
    useLang();
    const [mounted, setMounted] = useState(false);
    const [showing, setShowing] = useState(false);
    const [search, setSearch] = useState('');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const sheetRef = useRef<HTMLDivElement>(null);

    const country = ALLOWED_COUNTRIES.find(c => c.code === selected) ?? ALLOWED_COUNTRIES[0];

    const getName = (c: typeof ALLOWED_COUNTRIES[0]) =>
        t(`country.${c.code}`) || (getLang() === 'es' ? c.nameEs : c.nameEn);

    const filtered = ALLOWED_COUNTRIES.filter(c => {
        const q = search.toLowerCase();
        return (
            c.nameEn.toLowerCase().includes(q) ||
            c.nameEs.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q) ||
            c.dialCode.includes(search.startsWith('+') ? search : q)
        );
    });

    const doClose = useCallback(() => {
        setMounted(false);
        setSearch('');
        document.body.style.overflow = '';
        requestAnimationFrame(() => triggerRef.current?.focus());
    }, []);

    const close = useCallback(() => {
        setShowing(false);
        if (reduced()) {
            doClose();
        } else {
            setTimeout(doClose, 210);
        }
    }, [doClose]);

    const openSheet = () => {
        setMounted(true);
        document.body.style.overflow = 'hidden';
    };

    // Trigger enter transition after mount
    useEffect(() => {
        if (!mounted) return;
        if (reduced()) { setShowing(true); return; }
        const id = requestAnimationFrame(() =>
            requestAnimationFrame(() => setShowing(true))
        );
        return () => cancelAnimationFrame(id);
    }, [mounted]);

    // Focus close button on open (avoids triggering the mobile keyboard)
    useEffect(() => {
        if (!mounted || !showing) return;
        const id = setTimeout(() => closeRef.current?.focus(), reduced() ? 0 : 120);
        return () => clearTimeout(id);
    }, [mounted, showing]);

    // Escape + focus trap
    useEffect(() => {
        if (!mounted) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { close(); return; }
            if (e.key !== 'Tab') return;
            const el = sheetRef.current;
            if (!el) return;
            const focusable = Array.from(
                el.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled])'
                )
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [mounted, close]);

    const handleSelect = (code: CountryCode) => {
        onChange(code);
        close();
    };

    const sheet = (
        <div
            className={`cs-overlay fixed inset-0 z-[9999] flex flex-col justify-end${showing ? ' cs-showing' : ''}`}
            onClick={e => { if (e.target === e.currentTarget) close(); }}
        >
            <div
                ref={sheetRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cs-title"
                className="cs-sheet flex flex-col rounded-t-[24px]"
                style={{
                    background: '#08101e',
                    boxShadow: '0 -12px 60px rgba(0,0,0,0.6), 0 -1px 0 rgba(255,255,255,0.06)',
                    maxHeight: 'min(72dvh, 580px)',
                    paddingBottom: 'env(safe-area-inset-bottom, 12px)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Drag handle — decorative */}
                <div className="flex justify-center pt-3 pb-0" aria-hidden="true">
                    <div className="w-9 rounded-full" style={{ height: 3, background: 'rgba(255,255,255,0.18)' }} />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between pl-5 pr-2 pt-2.5 pb-3">
                    <h2 id="cs-title" className="text-[17px] font-bold" style={{ color: '#fff' }}>
                        {t('phone.country_selector.title')}
                    </h2>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={() => close()}
                        aria-label={t('phone.country_selector.close')}
                        className="flex items-center justify-center rounded-full transition-opacity active:opacity-50"
                        style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.07)' }}
                    >
                        <X size={16} style={{ color: 'rgba(255,255,255,0.65)' }} aria-hidden="true" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-4 pb-3">
                    <div
                        className="flex items-center gap-2.5 rounded-[13px] px-3"
                        style={{
                            height: 44,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.09)',
                        }}
                    >
                        <Search size={14} style={{ color: 'rgba(255,255,255,0.38)' }} aria-hidden="true" />
                        <input
                            ref={searchRef}
                            type="search"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('phone.country_selector.search')}
                            aria-label={t('phone.country_selector.search')}
                            autoComplete="off"
                            className="flex-1 bg-transparent text-[14px] outline-none min-w-0"
                            style={{ color: '#fff', caretColor: '#3b82f6' }}
                        />
                        {search ? (
                            <button
                                type="button"
                                onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                                aria-label="Clear search"
                                className="flex items-center justify-center rounded-full -mr-1 transition-opacity active:opacity-50 shrink-0"
                                style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.1)' }}
                            >
                                <X size={11} style={{ color: 'rgba(255,255,255,0.6)' }} aria-hidden="true" />
                            </button>
                        ) : (
                            <span className="w-4 shrink-0" aria-hidden="true" />
                        )}
                    </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 0 4px' }} aria-hidden="true" />

                {/* Country list */}
                <div
                    className="overflow-y-auto flex-1"
                    style={{ WebkitOverflowScrolling: 'touch' as any }}
                    role="listbox"
                    aria-label={t('phone.country_selector.title')}
                >
                    {filtered.length === 0 ? (
                        <p className="text-center text-[14px] py-10" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {t('phone.country_selector.no_results')}
                        </p>
                    ) : (
                        filtered.map(c => {
                            const isSel = c.code === selected;
                            return (
                                <button
                                    key={c.code}
                                    type="button"
                                    role="option"
                                    aria-selected={isSel}
                                    aria-label={`${getName(c)}, ${c.dialCode}${isSel ? ', selected' : ''}`}
                                    onClick={() => handleSelect(c.code as CountryCode)}
                                    className="w-full flex items-center gap-3 px-4 transition-colors active:opacity-60"
                                    style={{
                                        minHeight: 56,
                                        background: isSel ? 'rgba(59,130,246,0.11)' : 'transparent',
                                        borderLeft: `2px solid ${isSel ? 'rgba(59,130,246,0.55)' : 'transparent'}`,
                                    }}
                                >
                                    {/* Flag */}
                                    <FlagImg code={c.code} size="md" />

                                    {/* Country name */}
                                    <span
                                        className="flex-1 text-left text-[15px] font-medium"
                                        style={{ color: isSel ? '#fff' : 'rgba(255,255,255,0.82)' }}
                                        aria-hidden="true"
                                    >
                                        {getName(c)}
                                    </span>

                                    {/* Calling code */}
                                    <span
                                        className="text-[13px] font-medium shrink-0"
                                        style={{
                                            color: 'rgba(255,255,255,0.38)',
                                            minWidth: 34,
                                            textAlign: 'right',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                        aria-hidden="true"
                                    >
                                        {c.dialCode}
                                    </span>

                                    {/* Check / fixed-width spacer */}
                                    <span className="w-5 shrink-0 flex justify-center" aria-hidden="true">
                                        {isSel && <Check size={15} style={{ color: '#60a5fa' }} />}
                                    </span>
                                </button>
                            );
                        })
                    )}
                    <div style={{ height: 8 }} aria-hidden="true" />
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Collapsed trigger: [flag] [dialCode] [▾] */}
            <button
                ref={triggerRef}
                type="button"
                onClick={openSheet}
                aria-label={`${t('phone.country_selector.title')}, ${getName(country)}, ${country.dialCode}`}
                aria-haspopup="dialog"
                aria-expanded={mounted}
                className="flex items-center gap-1.5 pl-3 pr-3 border-r border-[var(--color-border)] shrink-0 h-full select-none active:opacity-60 transition-opacity"
            >
                <FlagImg code={country.code} size="sm" />
                <span className="text-[13px] font-semibold text-[var(--color-text-secondary)] leading-none">
                    {country.dialCode}
                </span>
                <ChevronDown size={11} className="text-[var(--color-text-secondary)] opacity-60 shrink-0" aria-hidden="true" />
            </button>

            {mounted && createPortal(sheet, document.body)}
        </>
    );
};
