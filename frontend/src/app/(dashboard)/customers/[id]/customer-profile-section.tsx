'use client';

import { useState } from 'react';
import { Edit2, Loader2, Save, X } from 'lucide-react';

interface ProfileData {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  notes: string | null;
}

interface CustomerProfileSectionProps {
  profile: ProfileData;
  isSavePending: boolean;
  onSave: (data: { firstName: string; lastName: string; phone: string; notes: string }) => Promise<void>;
}

const FIELDS = [
  { key: 'firstName' as const, label: 'Prénom' },
  { key: 'lastName' as const, label: 'Nom' },
  { key: 'phone' as const, label: 'Téléphone' },
] as const;

export function CustomerProfileSection({
  profile,
  isSavePending,
  onSave,
}: CustomerProfileSectionProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    phone: profile.phone ?? '',
    notes: profile.notes ?? '',
  });

  async function handleSubmit() {
    try {
      await onSave(form);
      setEditing(false);
    } catch {
      // onError toast handled by parent mutation — form stays open
    }
  }

  function handleCancel() {
    setForm({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      phone: profile.phone ?? '',
      notes: profile.notes ?? '',
    });
    setEditing(false);
  }

  return (
    <section
      aria-labelledby="customer-profile-heading"
      className="bg-card border rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 id="customer-profile-heading" className="font-semibold">
          Informations client
        </h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 active:scale-[0.98] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
          >
            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
            Modifier
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSavePending}
              className="inline-flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isSavePending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {isSavePending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSavePending}
              className="inline-flex items-center gap-1 text-sm border px-3 py-1.5 rounded-lg hover:bg-muted active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Annuler
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <label htmlFor={`field-${key}`} className="text-sm font-medium">
                {label}
              </label>
              <input
                id={`field-${key}`}
                value={form[key]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background border-input"
              />
            </div>
          ))}
          <div className="col-span-1 sm:col-span-2 space-y-1">
            <label htmlFor="field-notes" className="text-sm font-medium">
              Notes
            </label>
            <textarea
              id="field-notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background border-input"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm mt-0.5">
                {profile[key] ?? (
                  <span className="text-muted-foreground italic">Non renseigné</span>
                )}
              </p>
            </div>
          ))}
          {profile.notes && (
            <div className="col-span-1 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm mt-0.5">{profile.notes}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
