import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusOnMount } from '../hooks/useFocusOnMount';
import {
  Camera, AlertCircle, CheckCircle2, Clock, Bell, ChevronLeft,
  Ruler, Shield, Sparkles, Zap, Building2, MessageSquareText, ImageIcon, X, ScanLine,
} from 'lucide-react';
import { analyzeParkingSign, SignAnalysisResult } from '../services/geminiService';
import { useParkingTimer } from './street-parking/useParkingTimer';
import { t, useLang } from '../i18n';
import { loadRecentScans, recordScan, RecentScan } from '../utils/recentScans';

type ScanState = 'idle' | 'preview' | 'analyzing' | 'done';

/** Most scans are looked back at the same day, when a bare date says nothing. */
function formatScanTime(ts: number): string {
  const d = new Date(ts);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString();
}


/**
 * The result payload sometimes packs a headline and a body into `explanation`
 * separated by a newline (see geminiService error branches). Split it so the
 * card can lead with the headline instead of rendering one dense paragraph.
 */
function splitExplanation(text: string): { headline: string | null; body: string } {
  const idx = (text || '').indexOf('\n');
  if (idx === -1) return { headline: null, body: text || '' };
  return { headline: text.slice(0, idx).trim(), body: text.slice(idx + 1).trim() };
}

export const AssistantView = () => {
  useLang();
  const [mode, setMode] = useState<'hub' | 'scan'>('hub');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [image, setImage] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SignAnalysisResult | null>(null);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Guards against a second submit while a request is already in flight, which
  // a fast double-tap on the CTA would otherwise produce.
  const inFlightRef = useRef(false);
  const { startTimer, timer } = useParkingTimer();
  useFocusOnMount(headingRef);

  useEffect(() => { setRecent(loadRecentScans()); }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImage(base64String);
      setImageData(base64String.split(',')[1]);
      setAnalysis(null);
      setScanState('preview');
    };
    reader.readAsDataURL(file);
    // Allow re-picking the same file twice in a row.
    event.target.value = '';
  };

  const analyze = useCallback(async (base64Data: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setScanState('analyzing');
    try {
      const result = await analyzeParkingSign(base64Data);
      setAnalysis(result);
      if (result.status !== 'ERROR') setRecent(recordScan(result));
    } catch {
      setAnalysis({ status: 'ERROR', explanation: t('assistant.error_generic') });
    } finally {
      inFlightRef.current = false;
      setScanState('done');
    }
  }, []);

  const openScanner = () => {
    setMode('scan');
    setScanState('idle');
    setImage(null);
    setImageData(null);
    setAnalysis(null);
  };

  const resetToIdle = () => {
    setImage(null);
    setImageData(null);
    setAnalysis(null);
    setScanState('idle');
  };

  const backToHub = () => {
    resetToIdle();
    setMode('hub');
    setRecent(loadRecentScans());
  };

  const reminderSet = !!timer;

  const setReminder = () => {
    if (!analysis) return;
    let minutes = 60;
    if (analysis.restrictionStartsAt) {
      const parsed = new Date(analysis.restrictionStartsAt);
      const diff = Math.ceil((parsed.getTime() - Date.now()) / 60_000);
      if (diff > 0) minutes = diff;
    }
    startTimer(minutes, 'parking sign');
  };

  const isError = analysis?.status === 'ERROR';

  return (
    <div className="pq-assist pb-24 px-4 h-full bg-[var(--color-bg)] overflow-y-auto no-scrollbar">
      {/* ── Hero intro (hub) ───────────────────────────────────────────────── */}
      {mode === 'hub' ? (
        <section className="pq-assist-hero relative overflow-hidden rounded-3xl px-5 py-5 mb-4">
          <div className="pq-assist-skyline" aria-hidden="true" />
          <div className="relative">
            <p className="text-[10px] font-bold tracking-[0.18em] text-[#38bdf8] mb-1.5">
              {t('assistant.eyebrow')}
            </p>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl font-extrabold text-[var(--color-text)] leading-tight focus:outline-none"
            >
              {t('assistant.hero_title')}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-[34ch]">
              {t('assistant.hero_sub')}
            </p>
          </div>
        </section>
      ) : (
        /* Compact header while scanning. The screen already sits under the
           app-level "Sign Scanner" bar, so repeating the full hero here is what
           made the original screen feel stacked and crowded. */
        <div className="mb-4">
          {/* A text pill, not another round chevron: the app bar directly above
              already owns a circular back button, and two identical controls
              both labelled "Back" are ambiguous by sight and by screen reader. */}
          <button
            type="button"
            onClick={backToHub}
            aria-label={t('assistant.back_hub_aria')}
            className="inline-flex items-center gap-1 min-h-[44px] pr-3 -ml-1 pl-1 rounded-full text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:outline-none transition-colors"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            {t('assistant.back_hub')}
          </button>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-extrabold text-[var(--color-text)] focus:outline-none"
          >
            {t('assistant.scan_title')}
          </h2>
        </div>
      )}

      {/* ── Hub ────────────────────────────────────────────────────────────── */}
      {mode === 'hub' && (
        <div className="space-y-4">
          {/* Primary scanner card. The whole card is the control, so it carries
              an explicit aria-label — otherwise its accessible name is the
              concatenated card text, which opens with "POWERED BY AI". */}
          <button
            type="button"
            onClick={openScanner}
            aria-label={t('assistant.scan_title')}
            className="pq-scan-card group w-full text-left rounded-3xl p-5 relative overflow-hidden focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:outline-none"
          >
            {/* In flow, not absolute: at 390px an absolutely positioned badge
                overlapped the wrapped title no matter how much padding the
                title reserved. */}
            <span className="mb-3 inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full bg-[#38bdf8]/12 text-[#38bdf8] border border-[#38bdf8]/30">
              <Sparkles size={11} aria-hidden="true" /> {t('assistant.powered_by_ai')}
            </span>

            <div className="flex items-center gap-4 mb-4">
              <span className="pq-scan-orb shrink-0" aria-hidden="true">
                <Camera size={30} className="text-white" />
              </span>
              <span className="block min-w-0">
                <span className="block font-extrabold text-lg text-[var(--color-text)] leading-snug">
                  {t('assistant.scan_title')}
                </span>
                <span className="block text-sm text-[var(--color-text-secondary)] mt-1 leading-snug">
                  {t('assistant.scan_desc_long')}
                </span>
              </span>
            </div>

            <span className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
              {[
                { icon: <Zap size={13} aria-hidden="true" />, label: t('assistant.chip_fast') },
                { icon: <Building2 size={13} aria-hidden="true" />, label: t('assistant.chip_nyc') },
                { icon: <MessageSquareText size={13} aria-hidden="true" />, label: t('assistant.chip_plain') },
              ].map(c => (
                <span key={c.label} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                  <span className="text-[#38bdf8]">{c.icon}</span>{c.label}
                </span>
              ))}
            </span>

            <span className="pq-cta block w-full text-center py-3 rounded-2xl font-bold text-white text-sm">
              {t('assistant.cta_scan')}
            </span>
          </button>

          {/* Secondary — not built yet */}
          {[
            { icon: <Ruler size={20} aria-hidden="true" />, title: t('assistant.hydrant_title'), desc: t('assistant.hydrant_desc') },
            { icon: <Shield size={20} aria-hidden="true" />, title: t('assistant.safe_title'), desc: t('assistant.safe_desc') },
          ].map(card => (
            <button
              key={card.title}
              type="button"
              disabled
              aria-disabled="true"
              aria-label={`${card.title} — ${t('assistant.coming_soon_aria')}`}
              className="pq-soon-card w-full text-left rounded-3xl p-4 flex items-center gap-4 cursor-not-allowed"
            >
              <span className="pq-soon-icon shrink-0" aria-hidden="true">{card.icon}</span>
              <span className="block flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-[var(--color-text)]">{card.title}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/8 text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                    {t('assistant.coming_soon')}
                  </span>
                </span>
                <span className="block text-xs text-[var(--color-text-secondary)] mt-1 leading-snug">{card.desc}</span>
              </span>
            </button>
          ))}

          {/* How it works */}
          <section className="rounded-3xl p-5 bg-[var(--color-card)] border border-[var(--color-border)]">
            <h3 className="text-[10px] font-bold tracking-[0.18em] text-[var(--color-text-secondary)] mb-4">
              {t('assistant.how_title')}
            </h3>
            <ol className="space-y-3.5">
              {[
                { n: '1', title: t('assistant.how_1_t'), desc: t('assistant.how_1_d') },
                { n: '2', title: t('assistant.how_2_t'), desc: t('assistant.how_2_d') },
                { n: '3', title: t('assistant.how_3_t'), desc: t('assistant.how_3_d') },
              ].map(step => (
                <li key={step.n} className="flex items-start gap-3.5">
                  <span className="pq-step shrink-0" aria-hidden="true">{step.n}</span>
                  <span className="block min-w-0">
                    <span className="block font-bold text-sm text-[var(--color-text)]">{step.title}</span>
                    <span className="block text-xs text-[var(--color-text-secondary)] mt-0.5 leading-snug">{step.desc}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* Recent scans — real local history only */}
          <section className="rounded-3xl p-5 bg-[var(--color-card)] border border-[var(--color-border)]">
            <h3 className="text-[10px] font-bold tracking-[0.18em] text-[var(--color-text-secondary)] mb-3">
              {t('assistant.recent_title')}
            </h3>
            {recent.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)] py-2">{t('assistant.recent_empty')}</p>
            ) : (
              <ul className="space-y-2.5">
                {recent.map(scan => (
                  <li key={scan.id} className="flex items-start gap-3">
                    <span className="pq-recent-dot shrink-0" aria-hidden="true">
                      {scan.status === 'NO'
                        ? <AlertCircle size={15} className="text-red-400" />
                        : scan.status === 'YES'
                          ? <CheckCircle2 size={15} className="text-green-400" />
                          : <Clock size={15} className="text-yellow-400" />}
                    </span>
                    <span className="block min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--color-text)] leading-snug">{scan.title}</span>
                      <span className="block text-xs text-[var(--color-text-secondary)] mt-0.5">
                        {formatScanTime(scan.ts)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ── Scan flow ──────────────────────────────────────────────────────── */}
      {mode === 'scan' && (
        <div className="flex flex-col items-center">
          <input
            type="file" ref={fileInputRef} onChange={handleFileChange}
            accept="image/*" capture="environment" className="hidden"
          />
          <input
            type="file" ref={galleryInputRef} onChange={handleFileChange}
            accept="image/*" className="hidden"
          />

          {/* A. idle */}
          {scanState === 'idle' && (
            <div className="w-full max-w-sm flex flex-col items-center pt-2">
              <span className="pq-scan-orb pq-scan-orb-lg mb-5" aria-hidden="true">
                <Camera size={40} className="text-white" />
              </span>
              <p className="text-sm text-[var(--color-text-secondary)] text-center mb-6 leading-relaxed">
                {t('assistant.photo_hint')}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="pq-cta w-full py-3.5 rounded-2xl font-bold text-white text-sm mb-3 focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:outline-none"
              >
                {t('assistant.open_camera')}
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] rounded-2xl border border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:outline-none transition-colors"
              >
                <ImageIcon size={16} aria-hidden="true" /> {t('assistant.choose_photos')}
              </button>
              <p className="text-[11px] text-[var(--color-text-secondary)] text-center mt-6 leading-relaxed px-4">
                {t('assistant.privacy_note')}
              </p>
            </div>
          )}

          {/* B/C/D/E — image chosen */}
          {scanState !== 'idle' && image && (
            <div className="w-full max-w-sm">
              <div className="relative rounded-3xl overflow-hidden border border-[var(--color-border)] shadow-2xl mb-4">
                {/* Once the verdict exists it is the point of the screen, so the
                    photo drops to a thumbnail — at 390x844 a full-height image
                    pushed the answer entirely below the fold. */}
                <img
                  src={image}
                  alt={t('assistant.preview_alt')}
                  className={`w-full h-auto object-cover ${scanState === 'done' ? 'max-h-[120px]' : 'max-h-[340px]'}`}
                />
                {scanState === 'analyzing' && <span className="pq-scanline" aria-hidden="true" />}
              </div>

              {/* B. preview — explicit confirm before spending a call */}
              {scanState === 'preview' && (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => imageData && analyze(imageData)}
                    className="pq-cta w-full py-3.5 rounded-2xl font-bold text-white text-sm inline-flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:outline-none"
                  >
                    <ScanLine size={17} aria-hidden="true" /> {t('assistant.analyze_cta')}
                  </button>
                  <button
                    type="button"
                    onClick={resetToIdle}
                    className="w-full min-h-[44px] rounded-2xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:outline-none transition-colors"
                  >
                    {t('assistant.retake')}
                  </button>
                  <button
                    type="button"
                    onClick={backToHub}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:outline-none rounded-2xl transition-colors"
                  >
                    <X size={15} aria-hidden="true" /> {t('assistant.cancel')}
                  </button>
                </div>
              )}

              {/* C/D/E — announced to screen readers */}
              <div aria-live="polite" role="status">
                {scanState === 'analyzing' && (
                  <div className="rounded-3xl p-6 bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col items-center">
                    <span className="pq-pulse-ring mb-4" aria-hidden="true">
                      <ScanLine size={22} className="text-[#38bdf8]" />
                    </span>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{t('assistant.reading_sign')}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('assistant.checking_rules')}</p>
                  </div>
                )}

                {scanState === 'done' && analysis && (
                  <div className="rounded-3xl p-5 bg-[var(--color-surface)] border border-[var(--color-border)]">
                    {(() => {
                      const { headline, body } = splitExplanation(analysis.explanation);
                      const meta = isError
                        ? { icon: <AlertCircle className="text-yellow-500" size={22} />, label: t('assistant.error_title'), tone: 'text-yellow-400' }
                        : analysis.status === 'YES'
                          ? { icon: <CheckCircle2 className="text-green-500" size={22} />, label: t('assistant.result_yes'), tone: 'text-green-400' }
                          : analysis.status === 'NO'
                            ? { icon: <AlertCircle className="text-red-500" size={22} />, label: t('assistant.result_no'), tone: 'text-red-400' }
                            : { icon: <AlertCircle className="text-yellow-500" size={22} />, label: t('assistant.result_maybe'), tone: 'text-yellow-400' };
                      return (
                        <>
                          <div className="flex items-start gap-3 mb-3">
                            <span className="shrink-0 mt-0.5">{meta.icon}</span>
                            <span className={`font-extrabold text-lg leading-snug ${meta.tone}`}>{meta.label}</span>
                          </div>
                          {/* The service's error headline is often the same
                              sentence as the card label; printing both reads as
                              a stutter. */}
                          {headline && headline !== meta.label && (
                            <p className="text-sm font-semibold text-[var(--color-text)] mb-1.5">{headline}</p>
                          )}
                          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{body}</p>
                        </>
                      );
                    })()}

                    {analysis.actionableAdvice && (
                      <div className="mt-4 rounded-2xl p-3.5 bg-[#1e75ff]/10 border border-[#1e75ff]/30">
                        <p className="flex items-center gap-2 text-[#38bdf8] font-bold text-sm mb-1">
                          <Clock size={15} aria-hidden="true" /> {t('assistant.advice_label')}
                        </p>
                        <p className="text-sm text-[var(--color-text-secondary)]">{analysis.actionableAdvice}</p>
                        <button
                          type="button"
                          onClick={setReminder}
                          className="mt-3 w-full min-h-[44px] bg-[#1e75ff]/20 hover:bg-[#1e75ff]/35 text-[#7dd3fc] rounded-xl inline-flex items-center justify-center gap-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:outline-none transition-colors"
                        >
                          <Bell size={15} aria-hidden="true" /> {reminderSet ? t('assistant.reminder_set') : t('assistant.set_reminder')}
                        </button>
                      </div>
                    )}

                    {!isError && (
                      <p className="mt-4 text-[11px] text-[var(--color-text-secondary)] text-center leading-relaxed">
                        {t('assistant.disclaimer')}
                      </p>
                    )}

                    <div className="mt-4 space-y-2.5">
                      {isError ? (
                        <>
                          <button
                            type="button"
                            onClick={() => imageData && analyze(imageData)}
                            className="pq-cta w-full py-3 rounded-2xl font-bold text-white text-sm focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:outline-none"
                          >
                            {t('assistant.try_again')}
                          </button>
                          <button
                            type="button"
                            onClick={resetToIdle}
                            className="w-full min-h-[44px] rounded-2xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:outline-none transition-colors"
                          >
                            {t('assistant.choose_another')}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={resetToIdle}
                          className="w-full min-h-[44px] rounded-2xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:outline-none transition-colors"
                        >
                          {t('assistant.scan_another')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
