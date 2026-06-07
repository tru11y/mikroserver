'use client';

import type { Dispatch, SetStateAction } from 'react';
import {
  parseDurationInput,
  formatDurationDisplay,
  kbpsToMbps,
  mbpsToKbps,
} from './plans.utils';
import type { PlanFormData } from './plans.types';

interface PlanFormFieldsProps {
  form: PlanFormData;
  setForm: Dispatch<SetStateAction<PlanFormData>>;
  idPrefix?: string;
}

const inputCls =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]';

const selectCls =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]';

export function PlanFormFields({ form, setForm, idPrefix = 'plan' }: PlanFormFieldsProps) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="space-y-6">
      {/* ── Base ──────────────────────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="space-y-0.5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Base
          </p>
          <p className="text-xs text-muted-foreground">
            Prix, durée, débit et profil hotspot du forfait.
          </p>
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor={id('name')} className="text-sm font-medium">
              Nom du forfait <span aria-hidden="true">*</span>
            </label>
            <input
              id={id('name')}
              className={inputCls}
              placeholder="ex : 1 jour – 300 FCFA"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              aria-required="true"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor={id('description')} className="text-sm font-medium">
              Description
            </label>
            <input
              id={id('description')}
              className={inputCls}
              placeholder="Description courte terrain"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id('price')} className="text-sm font-medium">
              Prix (FCFA) <span aria-hidden="true">*</span>
            </label>
            <input
              id={id('price')}
              type="number"
              min={0}
              className={inputCls}
              value={form.priceXof}
              onChange={(e) =>
                setForm((f) => ({ ...f, priceXof: parseInt(e.target.value, 10) || 0 }))
              }
              required
              aria-required="true"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id('duration')} className="text-sm font-medium">
              Durée <span aria-hidden="true">*</span>
            </label>
            <input
              id={id('duration')}
              type="text"
              className={inputCls}
              defaultValue={formatDurationDisplay(form.durationMinutes)}
              key={form.durationMinutes}
              placeholder="ex : 7h 00:00:00, 3d 00:00:00, 0:30:00"
              aria-describedby={id('duration-hint')}
              onBlur={(e) => {
                const parsed = parseDurationInput(e.target.value);
                if (parsed !== null) {
                  setForm((f) => ({ ...f, durationMinutes: parsed }));
                  e.target.value = formatDurationDisplay(parsed);
                } else {
                  e.target.value = formatDurationDisplay(form.durationMinutes);
                }
              }}
            />
            <p id={id('duration-hint')} className="text-xs text-muted-foreground">
              Style WinBox — ex : <code>7h 00:00:00</code> · <code>3d</code> · <code>0:30:00</code>
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id('download')} className="text-sm font-medium">
              Download (Mbps)
            </label>
            <input
              id={id('download')}
              type="number"
              min={0}
              step={0.5}
              className={inputCls}
              value={kbpsToMbps(form.downloadKbps)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  downloadKbps: mbpsToKbps(parseFloat(e.target.value) || 0),
                }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id('upload')} className="text-sm font-medium">
              Upload (Mbps)
            </label>
            <input
              id={id('upload')}
              type="number"
              min={0}
              step={0.5}
              className={inputCls}
              value={kbpsToMbps(form.uploadKbps)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  uploadKbps: mbpsToKbps(parseFloat(e.target.value) || 0),
                }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id('data-limit')} className="text-sm font-medium">
              Quota data (Mo)
            </label>
            <input
              id={id('data-limit')}
              type="number"
              min={0}
              className={inputCls}
              value={form.dataLimitMb}
              onChange={(e) =>
                setForm((f) => ({ ...f, dataLimitMb: parseInt(e.target.value, 10) || 0 }))
              }
              aria-describedby={id('data-limit-hint')}
            />
            <p id={id('data-limit-hint')} className="text-xs text-muted-foreground">
              0 = illimité
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id('profile')} className="text-sm font-medium">
              Profil hotspot
            </label>
            <input
              id={id('profile')}
              className={inputCls}
              value={form.userProfile}
              onChange={(e) => setForm((f) => ({ ...f, userProfile: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id('display-order')} className="text-sm font-medium">
              Ordre d'affichage
            </label>
            <input
              id={id('display-order')}
              type="number"
              className={inputCls}
              value={form.displayOrder}
              onChange={(e) =>
                setForm((f) => ({ ...f, displayOrder: parseInt(e.target.value, 10) || 0 }))
              }
            />
          </div>

          <div className="flex items-center gap-2 pt-6">
            <input
              id={id('is-popular')}
              type="checkbox"
              checked={form.isPopular}
              onChange={(e) => setForm((f) => ({ ...f, isPopular: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
            />
            <label htmlFor={id('is-popular')} className="text-sm font-medium cursor-pointer">
              Forfait populaire
            </label>
          </div>
        </div>
      </fieldset>

      {/* ── Ticketing ────────────────────────────────────────────────────── */}
      <fieldset className="space-y-4 rounded-xl border bg-muted/20 p-4">
        <legend className="space-y-0.5 px-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Ticketing
          </p>
          <p className="text-xs text-muted-foreground">
            Type MikroTicket : PIN ou user/password, préfixe, longueur, durée écoulée ou pausée.
          </p>
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={id('ticket-type')} className="text-sm font-medium">
              Type de ticket
            </label>
            <select
              id={id('ticket-type')}
              value={form.ticketType}
              onChange={(e) =>
                setForm((f) => ({ ...f, ticketType: e.target.value as PlanFormData['ticketType'] }))
              }
              className={selectCls}
            >
              <option value="PIN">PIN (même code et mot de passe)</option>
              <option value="USER_PASSWORD">User / Password</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id('duration-mode')} className="text-sm font-medium">
              Mode de durée
            </label>
            <select
              id={id('duration-mode')}
              value={form.durationMode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  durationMode: e.target.value as PlanFormData['durationMode'],
                }))
              }
              className={selectCls}
            >
              <option value="ELAPSED">Temps écoulé</option>
              <option value="PAUSED">Temps pausé</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id('ticket-prefix')} className="text-sm font-medium">
              Préfixe ticket
            </label>
            <input
              id={id('ticket-prefix')}
              className={inputCls}
              placeholder="MS ou 1m"
              value={form.ticketPrefix}
              onChange={(e) => setForm((f) => ({ ...f, ticketPrefix: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id('code-length')} className="text-sm font-medium">
              Longueur code
            </label>
            <select
              id={id('code-length')}
              value={form.ticketCodeLength}
              onChange={(e) =>
                setForm((f) => ({ ...f, ticketCodeLength: parseInt(e.target.value, 10) }))
              }
              className={selectCls}
            >
              {[4, 5, 6, 7, 8, 10, 12, 16].map((l) => (
                <option key={l} value={l}>
                  {l} caractères
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id('users-per-ticket')} className="text-sm font-medium">
              Utilisateurs par ticket
            </label>
            <input
              id={id('users-per-ticket')}
              type="number"
              min={1}
              className={inputCls}
              value={form.usersPerTicket}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  usersPerTicket: Math.max(1, parseInt(e.target.value, 10) || 1),
                }))
              }
            />
          </div>

          <div className="flex items-center gap-2 pt-6">
            <input
              id={id('numeric-only')}
              type="checkbox"
              checked={form.ticketNumericOnly}
              onChange={(e) => setForm((f) => ({ ...f, ticketNumericOnly: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
            />
            <label htmlFor={id('numeric-only')} className="text-sm font-medium cursor-pointer">
              Code numérique uniquement
            </label>
          </div>
        </div>

        {form.ticketType === 'USER_PASSWORD' && (
          <div className="grid gap-4 sm:grid-cols-2 border-t border-border/40 pt-4">
            <div className="space-y-1.5">
              <label htmlFor={id('pwd-length')} className="text-sm font-medium">
                Longueur mot de passe
              </label>
              <select
                id={id('pwd-length')}
                value={form.ticketPasswordLength}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ticketPasswordLength: parseInt(e.target.value, 10) }))
                }
                className={selectCls}
              >
                {[4, 5, 6, 7, 8, 10, 12, 16].map((l) => (
                  <option key={l} value={l}>
                    {l} caractères
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                id={id('pwd-numeric-only')}
                type="checkbox"
                checked={form.ticketPasswordNumericOnly}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ticketPasswordNumericOnly: e.target.checked }))
                }
                className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
              />
              <label htmlFor={id('pwd-numeric-only')} className="text-sm font-medium cursor-pointer">
                Mot de passe numérique uniquement
              </label>
            </div>
          </div>
        )}
      </fieldset>
    </div>
  );
}
