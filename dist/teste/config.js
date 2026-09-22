export const config = Object.freeze({
  version: '0.2.0-admin-local',
  questionnaireVersion: 'prd-1.0-draft-2',
  privacyVersion: 'local-server-1',
  checkoutUrl: 'https://pay.hotmart.com/D107689179A',
  campaignCheckouts: {},
  price: 'R$ 27',
  processingMs: 2200,
});

export function checkoutFor(campaign) {
  const value = Object.hasOwn(config.campaignCheckouts, campaign || '')
    ? config.campaignCheckouts[campaign] : config.checkoutUrl;
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; }
  catch { return null; }
}
