'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wifi,
  CreditCard,
  Tag,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Zap,
  Clock,
  Database,
  WifiOff,
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  priceXof: number;
  downloadKbps: number | null;
  uploadKbps: number | null;
  dataLimitMb: number | null;
  isPopular: boolean;
}

interface BrandConfig {
  platformName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  supportEmail: string | null;
  supportPhone: string | null;
  footerText: string | null;
}

type PortalStep = 'plans' | 'voucher' | 'payment-wait' | 'success' | 'error';

const DEFAULT_BRAND: BrandConfig = {
  platformName: 'WiFi',
  logoUrl: null,
  primaryColor: '#6366f1',
  accentColor: '#8b5cf6',
  supportEmail: null,
  supportPhone: null,
  footerText: null,
};

const API_BASE =
  typeof window !== 'undefined'
    ? window.location.origin + '/proxy/api/v1'
    : '/proxy/api/v1';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const h = Math.round(minutes / 60);
    return `${h}h`;
  }
  const d = Math.round(minutes / 1440);
  return `${d} jour${d > 1 ? 's' : ''}`;
}

function formatData(mb: number | null): string {
  if (!mb) return 'Illimité';
  if (mb < 1024) return `${mb} Mo`;
  return `${(mb / 1024).toFixed(1)} Go`;
}

function formatSpeed(kbps: number | null): string {
  if (!kbps) return 'Illimité';
  if (kbps < 1000) return `${kbps} Kbps`;
  const mbps = kbps / 1000;
  return mbps % 1 === 0 ? `${mbps} Mbps` : `${mbps.toFixed(1)} Mbps`;
}

// ---------------------------------------------------------------------------
// Animated SVG progress ring (pure SVG + Tailwind, no extra deps)
// ---------------------------------------------------------------------------
function PulsingRing({ color }: { color: string }) {
  return (
    <div className="relative w-24 h-24 mx-auto">
      {/* Outer pulsing halo */}
      <span
        className="absolute inset-0 rounded-full animate-ping opacity-20"
        style={{ background: color }}
      />
      {/* Spinning arc */}
      <svg
        className="absolute inset-0 w-full h-full -rotate-90"
        viewBox="0 0 96 96"
        fill="none"
      >
        {/* Track */}
        <circle
          cx="48"
          cy="48"
          r="40"
          stroke={color}
          strokeOpacity="0.15"
          strokeWidth="6"
        />
        {/* Arc — animates via a CSS keyframe declared inline below */}
        <circle
          cx="48"
          cy="48"
          r="40"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="251.2"
          strokeDashoffset="188.4"
          style={{ animation: 'portal-spin 1.4s linear infinite' }}
        />
      </svg>
      {/* Wave icon centred */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Wifi
          className="w-9 h-9"
          style={{ color, animation: 'portal-pulse 2s ease-in-out infinite' }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Countdown hook — counts down from `seconds` to 0, then resets
// ---------------------------------------------------------------------------
function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    setRemaining(seconds);
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) return seconds;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return remaining;
}

// ---------------------------------------------------------------------------
// Copyable voucher box
// ---------------------------------------------------------------------------
function CopyableCode({
  code,
  primaryColor,
}: {
  code: string;
  primaryColor: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback for non-secure contexts (captive portal HTTP)
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group w-full rounded-2xl border-2 border-dashed transition-all select-none"
      style={{
        borderColor: copied ? '#22c55e' : primaryColor,
        background: copied ? '#f0fdf4' : `${primaryColor}0d`,
      }}
      title="Cliquez pour copier"
    >
      <div className="p-4">
        <p className="text-xs font-medium text-gray-400 mb-2 tracking-wide uppercase">
          Votre code d&apos;accès
        </p>
        <p
          className="font-mono font-extrabold text-3xl tracking-[0.25em] text-gray-900 break-all"
          style={{ color: copied ? '#16a34a' : undefined }}
        >
          {code}
        </p>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium">
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span className="text-green-600">Copié !</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              <span className="text-gray-400 group-hover:text-gray-600 transition-colors">
                Appuyez pour copier
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main portal component
// ---------------------------------------------------------------------------
export function PortalContent() {
  const params = useSearchParams();
  const mac = params.get('mac') ?? '';
  const routerId = params.get('router') ?? '';
  const linkLogin = params.get('link-login') ?? '';
  const linkOrig = params.get('link-orig') ?? 'http://google.com';

  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [step, setStep] = useState<PortalStep>('plans');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [phone, setPhone] = useState('');
  const [voucher, setVoucher] = useState('');
  const [activeTab, setActiveTab] = useState<'plans' | 'voucher'>('plans');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [, setTxId] = useState('');
  const [successVoucher, setSuccessVoucher] = useState('');
  const [autoRedirecting, setAutoRedirecting] = useState(false);

  // For voucher tab visual feedback
  const voucher_trimmed = voucher.trim();
  const voucherInputRef = useRef<HTMLInputElement>(null);

  const countdown = useCountdown(5); // "Vérification dans Xs..."

  useEffect(() => {
    fetch(`${API_BASE}/plans/public`)
      .then((r) => r.json())
      .then((data) => {
        const list = data?.data ?? data;
        setPlans(Array.isArray(list) ? list : []);
      })
      .catch(() => {});

    if (routerId) {
      fetch(`${API_BASE}/routers/public/${routerId}`)
        .then((r) => r.json())
        .then((routerData) => {
          const ownerId = routerData?.data?.ownerId ?? routerData?.ownerId;
          if (!ownerId) return null;
          return fetch(`${API_BASE}/white-label/public/${ownerId}`);
        })
        .then((r) => r?.json())
        .then((cfg) => {
          const raw = cfg?.data ?? cfg;
          if (raw?.primaryColor) {
            setBrand({ ...DEFAULT_BRAND, ...raw });
          }
        })
        .catch(() => {});
    }
  }, [routerId]);

  const doMikroTikLogin = useCallback(
    (code: string) => {
      if (!linkLogin) return;
      const qs = new URLSearchParams({
        username: code,
        password: code,
        dst: linkOrig,
      });
      window.location.href = `${linkLogin}?${qs.toString()}`;
    },
    [linkLogin, linkOrig],
  );

  const handleVoucherLogin = async () => {
    const code = voucher_trimmed;
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      if (linkLogin) {
        doMikroTikLogin(code);
        return;
      }
      setSuccessVoucher(code);
      setStep('success');
    } catch {
      setError('Impossible de se connecter. Vérifiez votre code.');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyPlan = async () => {
    if (!selectedPlan || !phone.trim()) return;
    setLoading(true);
    setError('');
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`${API_BASE}/transactions/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          customerPhone: `+225${phone.replace(/\s/g, '')}`,
          customerName: mac || undefined,
          provider: 'WAVE',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message ?? json?.data?.message ?? 'Erreur de paiement');
      }
      const txData = json?.data ?? json;
      const transactionId: string = txData?.transaction?.id;
      const waveUrl: string = txData?.paymentUrl;
      if (!transactionId || !waveUrl) {
        throw new Error('Réponse du serveur invalide');
      }
      setTxId(transactionId);
      setPaymentUrl(waveUrl);
      setStep('payment-wait');
      window.open(waveUrl, '_blank');
      startPolling(transactionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du paiement');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (id: string) => {
    let attempts = 0;
    const maxAttempts = 72; // 6 minutes at 5s interval
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setError(
          'Délai de paiement dépassé. Contactez le support si le paiement a été effectué.',
        );
        setStep('error');
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/transactions/portal/status/${id}`);
        const json = await res.json();
        const statusData = json?.data ?? json;
        if (statusData.status === 'COMPLETED') {
          clearInterval(interval);
          const code: string = statusData.voucherCode ?? '';
          setSuccessVoucher(code);
          setStep('success');
          if (code && linkLogin) {
            setAutoRedirecting(true);
            setTimeout(() => doMikroTikLogin(code), 3000);
          }
        } else if (statusData.status === 'FAILED') {
          clearInterval(interval);
          setError('Paiement échoué ou annulé. Veuillez réessayer.');
          setStep('error');
        }
      } catch {
        // continue polling silently
      }
    }, 5000);
  };

  const resetToPlans = () => {
    setStep('plans');
    setActiveTab('plans');
    setError('');
    setTxId('');
    setPaymentUrl('');
    setAutoRedirecting(false);
  };

  const primaryStyle = {
    '--portal-primary': brand.primaryColor,
    '--portal-accent': brand.accentColor,
  } as React.CSSProperties;

  const bgGradient = `linear-gradient(135deg, ${brand.primaryColor}18 0%, ${brand.accentColor}18 100%)`;

  // Format phone for display in payment-wait screen
  const displayPhone = phone.trim() ? `+225 ${phone.trim()}` : '';

  return (
    <>
      {/*
        Keyframe animations injected once — Tailwind alone can't do
        arbitrary arc-spin or brightness-pulse without a plugin.
      */}
      <style>{`
        @keyframes portal-spin {
          0%   { stroke-dashoffset: 188.4; transform: rotate(0deg);   transform-origin: center; }
          50%  { stroke-dashoffset: 62.8; }
          100% { stroke-dashoffset: 188.4; transform: rotate(360deg); transform-origin: center; }
        }
        @keyframes portal-pulse {
          0%, 100% { opacity: 1;   transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.9); }
        }
      `}</style>

      <div
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{ ...primaryStyle, background: bgGradient }}
      >
        {/* Header branding */}
        <div className="text-center mb-6">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={brand.platformName}
              className="h-16 mx-auto mb-2 object-contain"
            />
          ) : (
            <div className="flex items-center justify-center gap-2 mb-2">
              <Wifi className="h-8 w-8" style={{ color: brand.primaryColor }} />
              <span
                className="text-2xl font-bold"
                style={{ color: brand.primaryColor }}
              >
                {brand.platformName}
              </span>
            </div>
          )}
          <p className="text-gray-500 text-sm">Connectez-vous à Internet</p>
        </div>

        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* ---- PLANS / VOUCHER TABS ---- */}
          {(step === 'plans' || step === 'voucher') && (
            <>
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => {
                    setActiveTab('plans');
                    setStep('plans');
                    setError('');
                  }}
                  className="flex-1 py-3 text-sm font-medium transition-colors"
                  style={
                    activeTab === 'plans'
                      ? {
                          borderBottom: `2px solid ${brand.primaryColor}`,
                          color: brand.primaryColor,
                        }
                      : { color: '#6b7280' }
                  }
                >
                  <CreditCard className="h-4 w-4 inline mr-1" />
                  Acheter
                </button>
                <button
                  onClick={() => {
                    setActiveTab('voucher');
                    setStep('voucher');
                    setError('');
                  }}
                  className="flex-1 py-3 text-sm font-medium transition-colors"
                  style={
                    activeTab === 'voucher'
                      ? {
                          borderBottom: `2px solid ${brand.primaryColor}`,
                          color: brand.primaryColor,
                        }
                      : { color: '#6b7280' }
                  }
                >
                  <Tag className="h-4 w-4 inline mr-1" />
                  Code voucher
                </button>
              </div>

              {/* ----- BUY TAB ----- */}
              {activeTab === 'plans' && (
                <div className="p-4 space-y-3">
                  <p className="text-sm text-gray-500">Choisissez un forfait :</p>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {plans.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                        <WifiOff className="h-8 w-8 opacity-40" />
                        <p className="text-sm">Aucun forfait disponible pour le moment.</p>
                      </div>
                    )}
                    {plans.map((plan) => {
                      const isSelected = selectedPlan?.id === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() =>
                            setSelectedPlan(isSelected ? null : plan)
                          }
                          className="w-full text-left p-3.5 rounded-xl border-2 transition-all"
                          style={
                            isSelected
                              ? {
                                  borderColor: brand.primaryColor,
                                  background: `${brand.primaryColor}10`,
                                }
                              : { borderColor: '#e5e7eb', background: 'white' }
                          }
                        >
                          {/* Row 1 — name + price */}
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-900 truncate">
                                {plan.name}
                              </p>
                              {plan.isPopular && (
                                <span
                                  className="shrink-0 px-1.5 py-0.5 rounded text-white text-[10px] font-semibold"
                                  style={{ background: brand.accentColor }}
                                >
                                  Populaire
                                </span>
                              )}
                            </div>
                            <span
                              className="shrink-0 font-bold text-base"
                              style={{ color: brand.primaryColor }}
                            >
                              {plan.priceXof.toLocaleString('fr-FR')} FCFA
                            </span>
                          </div>

                          {/* Row 2 — chips */}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {/* Duration */}
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                              <Clock className="w-3 h-3" />
                              {formatDuration(plan.durationMinutes)}
                            </span>
                            {/* Data */}
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                              <Database className="w-3 h-3" />
                              {formatData(plan.dataLimitMb)}
                            </span>
                            {/* Speed — show download if present */}
                            {(plan.downloadKbps !== null || plan.uploadKbps !== null) && (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5"
                                style={{
                                  background: `${brand.primaryColor}15`,
                                  color: brand.primaryColor,
                                }}
                              >
                                <Zap className="w-3 h-3" />
                                {plan.downloadKbps !== null
                                  ? formatSpeed(plan.downloadKbps)
                                  : formatSpeed(plan.uploadKbps)}
                              </span>
                            )}
                          </div>

                          {/* Description (if any) */}
                          {plan.description && (
                            <p className="mt-1.5 text-[11px] text-gray-400 leading-snug">
                              {plan.description}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedPlan && (
                    <div className="pt-2 space-y-3 border-t border-gray-100">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Numéro Wave (Mobile Money)
                        </label>
                        {/* Country prefix + input */}
                        <div className="flex rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:border-transparent transition-all"
                          style={{ ['--tw-ring-color' as string]: brand.primaryColor }}
                        >
                          {/* Prefix block */}
                          <div className="flex items-center gap-1.5 px-3 bg-gray-50 border-r border-gray-300 shrink-0">
                            {/* Côte d'Ivoire flag emoji */}
                            <span className="text-base leading-none" aria-label="Côte d'Ivoire">
                              🇨🇮
                            </span>
                            <span className="text-sm font-medium text-gray-600">+225</span>
                          </div>
                          <input
                            type="tel"
                            className="flex-1 px-3 py-2.5 text-sm bg-white focus:outline-none"
                            placeholder="07 XX XX XX XX"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleBuyPlan()}
                            inputMode="tel"
                            autoComplete="tel-national"
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-gray-400">
                          Le numéro Wave associé à votre compte Mobile Money
                        </p>
                      </div>

                      {error && (
                        <p className="text-xs text-red-500 flex items-center gap-1.5 bg-red-50 rounded-lg px-3 py-2">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          {error}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={handleBuyPlan}
                        disabled={loading || !phone.trim()}
                        className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                        style={{ background: brand.primaryColor }}
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <span>
                              Payer {selectedPlan.priceXof.toLocaleString('fr-FR')} FCFA via Wave
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ----- VOUCHER TAB ----- */}
              {activeTab === 'voucher' && (
                <div className="p-5 space-y-4">
                  <div className="text-center">
                    <Tag className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm font-medium text-gray-700">
                      Entrez votre code voucher
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Reçu par SMS, e-mail ou auprès d&apos;un revendeur
                    </p>
                  </div>

                  {/* Input with clear button */}
                  <div
                    className="relative rounded-xl border-2 transition-all overflow-hidden"
                    style={{
                      borderColor: voucher_trimmed
                        ? brand.primaryColor
                        : '#e5e7eb',
                    }}
                  >
                    <input
                      ref={voucherInputRef}
                      type="text"
                      className="w-full px-4 py-4 text-center font-mono text-xl font-bold tracking-[0.3em] uppercase bg-white focus:outline-none"
                      placeholder="XXXX-XXXX"
                      value={voucher}
                      maxLength={24}
                      onChange={(e) =>
                        setVoucher(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
                      }
                      onKeyDown={(e) => e.key === 'Enter' && handleVoucherLogin()}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {voucher && (
                      <button
                        type="button"
                        onClick={() => {
                          setVoucher('');
                          voucherInputRef.current?.focus();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none"
                        aria-label="Effacer"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Character count hint */}
                  <p className="text-center text-[11px] text-gray-400">
                    {voucher_trimmed.length > 0
                      ? `${voucher_trimmed.length} caractère${voucher_trimmed.length > 1 ? 's' : ''} saisi${voucher_trimmed.length > 1 ? 's' : ''}`
                      : 'Le code se trouve sur votre reçu'}
                  </p>

                  {error && (
                    <p className="text-xs text-red-500 flex items-center gap-1.5 bg-red-50 rounded-lg px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {error}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleVoucherLogin}
                    disabled={loading || !voucher_trimmed}
                    className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
                    style={{ background: brand.primaryColor }}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Wifi className="h-4 w-4" />
                        Se connecter au WiFi
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-gray-400">
                    Pas de code ?{' '}
                    <button
                      type="button"
                      className="underline font-medium"
                      style={{ color: brand.primaryColor }}
                      onClick={() => {
                        setActiveTab('plans');
                        setStep('plans');
                        setError('');
                      }}
                    >
                      Achetez un forfait
                    </button>
                  </p>
                </div>
              )}
            </>
          )}

          {/* ---- PAYMENT WAIT ---- */}
          {step === 'payment-wait' && (
            <div className="p-8 text-center space-y-5">
              <PulsingRing color={brand.primaryColor} />

              <div>
                <p className="font-bold text-gray-900 text-lg">
                  En attente de votre paiement Wave
                </p>
                {displayPhone && (
                  <p className="mt-1 text-sm text-gray-500">
                    Numéro Wave :{' '}
                    <span className="font-semibold text-gray-800 tracking-wide">
                      {displayPhone}
                    </span>
                  </p>
                )}
              </div>

              <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                Complétez le paiement dans l&apos;application Wave puis revenez ici.
                La page se met à jour automatiquement.
              </p>

              {/* Countdown hint */}
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                style={{
                  background: `${brand.primaryColor}12`,
                  color: brand.primaryColor,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: brand.primaryColor }}
                />
                Vérification dans {countdown}s…
              </div>

              {paymentUrl && (
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ background: brand.primaryColor }}
                >
                  Ouvrir Wave
                </a>
              )}

              <button
                type="button"
                onClick={resetToPlans}
                className="block mx-auto text-xs text-gray-400 underline"
              >
                Annuler
              </button>
            </div>
          )}

          {/* ---- SUCCESS ---- */}
          {step === 'success' && (
            <div className="p-8 text-center space-y-5">
              <div>
                <CheckCircle className="h-14 w-14 mx-auto text-green-500 mb-2" />
                <p className="font-bold text-green-600 text-xl">Paiement confirmé !</p>
                {selectedPlan && (
                  <p className="text-sm text-gray-500 mt-1">
                    Forfait{' '}
                    <span className="font-semibold text-gray-700">
                      {selectedPlan.name}
                    </span>{' '}
                    —{' '}
                    <span className="font-semibold text-gray-700">
                      {formatDuration(selectedPlan.durationMinutes)}
                    </span>
                  </p>
                )}
              </div>

              {successVoucher && (
                <CopyableCode code={successVoucher} primaryColor={brand.primaryColor} />
              )}

              {autoRedirecting ? (
                <div className="flex flex-col items-center gap-2 text-sm text-gray-500">
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    style={{ color: brand.primaryColor }}
                  />
                  <span>Connexion en cours…</span>
                  <span className="text-xs text-gray-400">
                    Redirection automatique dans 3 secondes
                  </span>
                </div>
              ) : linkLogin && successVoucher ? (
                <div className="flex flex-col items-center gap-2 text-sm text-gray-500">
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    style={{ color: brand.primaryColor }}
                  />
                  <span>Connexion en cours…</span>
                </div>
              ) : (
                <a
                  href={linkOrig}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ background: brand.primaryColor }}
                >
                  <Wifi className="h-4 w-4" />
                  Se connecter au WiFi
                </a>
              )}
            </div>
          )}

          {/* ---- ERROR ---- */}
          {step === 'error' && (
            <div className="p-8 text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
              <p className="font-semibold text-red-600">Une erreur est survenue</p>
              <p className="text-sm text-gray-500 leading-relaxed">{error}</p>
              {brand.supportPhone && (
                <p className="text-xs text-gray-400">
                  Support :{' '}
                  <a
                    href={`tel:${brand.supportPhone}`}
                    className="underline font-medium"
                  >
                    {brand.supportPhone}
                  </a>
                </p>
              )}
              <button
                type="button"
                onClick={resetToPlans}
                className="mt-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: brand.primaryColor }}
              >
                Réessayer
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400 space-y-1">
          {brand.footerText && <p>{brand.footerText}</p>}
          {brand.supportPhone && <p>Support : {brand.supportPhone}</p>}
          {brand.supportEmail && <p>{brand.supportEmail}</p>}
        </div>
      </div>
    </>
  );
}
