/**
 * Branded HTML email templates for MikroServer.
 *
 * Rules:
 *  - All styles are inline (no CSS classes) — maximum client compatibility.
 *  - Max width 600 px, white content area, light-gray page background.
 *  - Brand accent: #6366f1 (indigo-500).
 *  - All copy is in French.
 *  - User-supplied strings are escaped to prevent HTML injection.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;
                      box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#6366f1;padding:28px 32px;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                MikroServer
              </span>
              <span style="font-size:13px;color:#c7d2fe;margin-left:8px;">Plateforme WiFi</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                Cet e-mail a été envoyé automatiquement par <strong>MikroServer</strong>.<br />
                Ne répondez pas à ce message. Pour toute assistance, contactez votre administrateur.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function primaryButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:6px;background-color:#6366f1;">
          <a href="${esc(url)}"
             style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;
                    color:#ffffff;text-decoration:none;border-radius:6px;letter-spacing:0.2px;">
            ${esc(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

function statRow(label: string, value: string, shaded = false): string {
  const bg = shaded ? "background-color:#f9fafb;" : "";
  return `
    <tr>
      <td style="${bg}padding:10px 14px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">
        ${esc(label)}
      </td>
      <td style="${bg}padding:10px 14px;font-size:14px;color:#111827;font-weight:600;
                  text-align:right;border-bottom:1px solid #e5e7eb;">
        ${value}
      </td>
    </tr>`;
}

function alertBadge(text: string, color: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;
                        background-color:${color}22;color:${color};font-size:12px;
                        font-weight:700;letter-spacing:0.5px;">${esc(text)}</span>`;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/**
 * Welcome email for newly onboarded operators.
 */
export function welcome(name: string, loginUrl: string): string {
  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">
      Bienvenue sur MikroServer, ${esc(name)}&nbsp;!
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#6b7280;line-height:1.7;">
      Votre compte opérateur a été créé avec succès. Vous pouvez désormais gérer
      vos routeurs, vos forfaits et suivre vos revenus en temps réel depuis le tableau
      de bord.
    </p>
    <p style="margin:0 0 4px;font-size:14px;color:#374151;font-weight:600;">
      Prochaines étapes
    </p>
    <ul style="margin:8px 0 0;padding-left:20px;font-size:14px;color:#4b5563;line-height:1.8;">
      <li>Connectez-vous à votre espace opérateur</li>
      <li>Ajoutez votre premier routeur MikroTik</li>
      <li>Créez vos forfaits WiFi et commencez à vendre</li>
    </ul>
    ${primaryButton("Accéder au tableau de bord", loginUrl)}
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
      Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail ou
      contactez notre support.
    </p>`;

  return shell(body);
}

/**
 * Voucher receipt delivered to the end customer after a successful payment.
 */
export function voucherReceipt(
  code: string,
  planName: string,
  duration: string,
  price: number,
  validUntil: string,
  platformName: string,
): string {
  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">
      Votre code d'accès WiFi
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.7;">
      Merci pour votre achat sur <strong>${esc(platformName)}</strong>. Voici votre
      code de connexion WiFi.
    </p>

    <!-- Voucher code box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#f5f3ff;border:2px dashed #6366f1;border-radius:8px;
                  margin-bottom:24px;">
      <tr>
        <td style="padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#7c3aed;font-weight:600;
                    letter-spacing:1px;text-transform:uppercase;">Code voucher</p>
          <p style="margin:0;font-size:32px;font-weight:700;color:#4f46e5;
                    letter-spacing:6px;font-family:'Courier New',Courier,monospace;">
            ${esc(code)}
          </p>
        </td>
      </tr>
    </table>

    <!-- Details table -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:6px;border-collapse:collapse;
                  margin-bottom:24px;overflow:hidden;">
      ${statRow("Forfait", esc(planName), false)}
      ${statRow("Durée", esc(duration), true)}
      ${statRow("Montant payé", `${price.toLocaleString("fr-FR")}&nbsp;FCFA`, false)}
      ${statRow("Valide jusqu'au", esc(validUntil), true)}
    </table>

    <p style="margin:0 0 8px;font-size:14px;color:#374151;font-weight:600;">
      Comment utiliser votre code&nbsp;?
    </p>
    <ol style="margin:8px 0 0;padding-left:20px;font-size:14px;color:#4b5563;line-height:1.9;">
      <li>Connectez-vous au réseau WiFi hotspot</li>
      <li>Une page de connexion s'ouvre automatiquement</li>
      <li>Saisissez le code ci-dessus dans le champ prévu</li>
      <li>Profitez de votre connexion&nbsp;!</li>
    </ol>
    <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">
      Ce code est à usage unique. Conservez cet e-mail jusqu'à l'expiration de votre forfait.
    </p>`;

  return shell(body);
}

/**
 * Password reset email containing a one-time OTP code.
 */
export function passwordReset(otpCode: string, expiresMinutes: number): string {
  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">
      Réinitialisation du mot de passe
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.7;">
      Vous avez demandé à réinitialiser votre mot de passe. Utilisez le code
      ci-dessous pour confirmer votre identité. Ce code est valable pendant
      <strong>${esc(expiresMinutes)} minute${expiresMinutes > 1 ? "s" : ""}</strong>.
    </p>

    <!-- OTP box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#fefce8;border:2px solid #fbbf24;border-radius:8px;
                  margin-bottom:24px;">
      <tr>
        <td style="padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#b45309;font-weight:600;
                    letter-spacing:1px;text-transform:uppercase;">Code de vérification</p>
          <p style="margin:0;font-size:36px;font-weight:700;color:#92400e;
                    letter-spacing:10px;font-family:'Courier New',Courier,monospace;">
            ${esc(otpCode)}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:14px;color:#374151;">
      Ne partagez jamais ce code. MikroServer ne vous demandera jamais ce code
      par téléphone ou via un autre canal.
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
      Si vous n'avez pas demandé de réinitialisation, ignorez cet e-mail. Votre mot de
      passe actuel reste inchangé.
    </p>`;

  return shell(body);
}

/**
 * Subscription expiry warning sent to the operator.
 */
export function subscriptionExpiring(
  tierName: string,
  daysLeft: number,
  renewUrl: string,
): string {
  const urgency =
    daysLeft <= 3
      ? { color: "#ef4444", label: "URGENT" }
      : { color: "#f59e0b", label: "AVERTISSEMENT" };

  const body = `
    <p style="margin:0 0 12px;">${alertBadge(urgency.label, urgency.color)}</p>
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">
      Votre abonnement expire bientôt
    </h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.7;">
      Votre abonnement <strong>${esc(tierName)}</strong> arrive à expiration dans
      <strong style="color:${urgency.color};">${esc(daysLeft)} jour${daysLeft > 1 ? "s" : ""}</strong>.
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      Après expiration, l'accès à votre tableau de bord et à la gestion de vos routeurs
      sera suspendu. Renouvelez dès maintenant pour assurer la continuité de service
      pour vos clients.
    </p>
    ${primaryButton("Renouveler mon abonnement", renewUrl)}
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
      Besoin d'aide&nbsp;? Contactez notre équipe commerciale pour un accompagnement personnalisé.
    </p>`;

  return shell(body);
}

/**
 * Router offline alert sent to the operator.
 */
export function routerOffline(routerName: string, since: string): string {
  const body = `
    <p style="margin:0 0 12px;">${alertBadge("ALERTE", "#ef4444")}</p>
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">
      Routeur hors ligne détecté
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.7;">
      Le routeur <strong>${esc(routerName)}</strong> est inaccessible depuis le
      <strong>${esc(since)}</strong>. Les clients connectés à ce point d'accès
      ne peuvent plus se connecter.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;
                  margin-bottom:24px;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#991b1b;">
            Actions recommandées
          </p>
          <ol style="margin:0;padding-left:18px;font-size:14px;color:#7f1d1d;line-height:1.9;">
            <li>Vérifiez l'alimentation électrique du routeur</li>
            <li>Contrôlez le tunnel WireGuard (interface wg0)</li>
            <li>Redémarrez le routeur si nécessaire</li>
            <li>Vérifiez la configuration RouterOS API</li>
          </ol>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:14px;color:#374151;">
      Si le problème persiste après vérification, contactez votre fournisseur d'accès
      ou consultez la documentation technique MikroServer.
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
      Cette alerte a été générée automatiquement par le système de surveillance MikroServer.
    </p>`;

  return shell(body);
}

/**
 * Daily summary report sent to the operator each morning.
 */
export function dailySummary(stats: {
  revenue: number;
  sessions: number;
  activeVouchers: number;
  date: string;
}): string {
  const body = `
    <h2 style="margin:0 0 4px;font-size:22px;color:#111827;">
      Résumé de la journée
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      ${esc(stats.date)}
    </p>

    <!-- Hero revenue stat -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:8px;
                  margin-bottom:20px;">
      <tr>
        <td style="padding:24px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#c7d2fe;font-weight:600;
                    letter-spacing:1px;text-transform:uppercase;">Revenus du jour</p>
          <p style="margin:0;font-size:36px;font-weight:700;color:#ffffff;">
            ${stats.revenue.toLocaleString("fr-FR")}&nbsp;<span style="font-size:20px;">FCFA</span>
          </p>
        </td>
      </tr>
    </table>

    <!-- Stats table -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:6px;border-collapse:collapse;
                  margin-bottom:24px;overflow:hidden;">
      ${statRow("Sessions actives", String(stats.sessions), false)}
      ${statRow("Vouchers actifs", String(stats.activeVouchers), true)}
    </table>

    <p style="margin:0;font-size:13px;color:#9ca3af;">
      Rapport généré automatiquement — Consultez votre tableau de bord pour l'analyse complète.
    </p>`;

  return shell(body);
}
