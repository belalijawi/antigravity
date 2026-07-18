// Creates a "Tahajjud+ — Product Analytics" dashboard in PostHog with insights
// for every event the app tracks. Idempotent-ish: re-running makes a fresh
// dashboard (PostHog allows duplicate names), so run once.
//
// USAGE:
//   POSTHOG_PERSONAL_API_KEY=phx_xxx node scripts/setup-posthog-dashboard.mjs
//
// Get a personal key: PostHog → Settings → Personal API keys → Create.
// Give it scopes: Dashboard (write), Insight (write), Project (read).
// Region is auto: this project is EU (eu.posthog.com). Override with
//   POSTHOG_API_HOST=https://us.posthog.com  if needed.

const KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const HOST = (process.env.POSTHOG_API_HOST || 'https://eu.posthog.com').replace(/\/$/, '');
if (!KEY) { console.error('Missing POSTHOG_PERSONAL_API_KEY'); process.exit(1); }

const H = { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function api(method, path, body) {
  const res = await fetch(`${HOST}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

const trend = (name, event, { breakdown, display = 'ActionsLineGraph', math = 'total' } = {}) => ({
  name,
  query: {
    kind: 'InsightVizNode',
    source: {
      kind: 'TrendsQuery',
      series: [{ kind: 'EventsNode', event, name: event, math }],
      interval: 'day',
      dateRange: { date_from: '-30d' },
      trendsFilter: { display },
      ...(breakdown ? { breakdownFilter: { breakdowns: [{ property: breakdown, type: 'event' }] } } : {}),
    },
  },
});

const funnel = (name, events) => ({
  name,
  query: {
    kind: 'InsightVizNode',
    source: {
      kind: 'FunnelsQuery',
      series: events.map((id) => ({ kind: 'EventsNode', event: id, name: id })),
      dateRange: { date_from: '-30d' },
      funnelsFilter: { funnelVizType: 'steps' },
    },
  },
});

const INSIGHTS = [
  // ── Acquisition & activation ──
  trend('Daily active users', 'app_launched', { math: 'dau' }),
  trend('App launches', 'app_launched'),
  funnel('Onboarding funnel', ['onboarding_step_viewed', 'onboarding_completed']),
  trend('Onboarding completed', 'onboarding_completed'),
  trend('Onboarding auth (by provider)', 'onboarding_auth_succeeded', { breakdown: 'provider', display: 'ActionsBar' }),
  trend('Permission results', 'onboarding_permission_result', { breakdown: 'granted', display: 'ActionsBar' }),
  // ── Monetisation ──
  funnel('Paywall → purchase', ['paywall_viewed', 'purchase_started', 'purchase_completed']),
  trend('Purchases completed (by source)', 'purchase_completed', { breakdown: 'source', display: 'ActionsBar' }),
  trend('Paywall views (by source)', 'paywall_viewed', { breakdown: 'source' }),
  trend('Restores succeeded', 'restore_succeeded'),
  // ── Core engagement ──
  trend('Prayers logged (by prayer)', 'prayer_logged', { breakdown: 'prayer' }),
  trend('Streak milestones (by nights)', 'streak_milestone', { breakdown: 'nights', display: 'ActionsBar' }),
  trend('Feature first used (by feature)', 'feature_first_used', { breakdown: 'feature', display: 'ActionsBarValue' }),
  trend('Tab views (by tab)', 'tab_viewed', { breakdown: 'tab', display: 'ActionsBarValue' }),
  // ── Feature-specific ──
  trend('Dua wall — Ameens', 'dua_ameen'),
  trend('Dua wall — posts', 'dua_posted'),
  trend('Hifz sessions completed', 'hifz_session_completed'),
  trend('Challenges completed (by kind)', 'challenge_completed', { breakdown: 'kind', display: 'ActionsBar' }),
  trend('Tasbeeh rounds (by dhikr)', 'tasbeeh_round', { breakdown: 'dhikr', display: 'ActionsBarValue' }),
];

(async () => {
  const projects = await api('GET', '/api/projects/');
  const proj = projects.results?.[0];
  const projectId = proj?.id;
  if (!projectId) throw new Error('Could not resolve project id');
  console.log(`Project: ${proj?.name ?? projectId} (id ${projectId})`);

  const DASH_NAME = 'Tahajjud+ — Product Analytics';
  const existing = (await api('GET', `/api/projects/${projectId}/dashboards/?limit=200`)).results?.find(d => d.name === DASH_NAME && !d.deleted);
  const dash = existing || await api('POST', `/api/projects/${projectId}/dashboards/`, {
    name: DASH_NAME,
    description: 'Auto-generated: acquisition, monetisation, engagement.',
  });
  console.log(`Dashboard ${existing ? 'reused' : 'created'}: ${HOST}/project/${projectId}/dashboard/${dash.id}`);

  let ok = 0;
  for (const ins of INSIGHTS) {
    try {
      await api('POST', `/api/projects/${projectId}/insights/`, { ...ins, dashboards: [dash.id] });
      ok++; console.log(`  ✓ ${ins.name}`);
    } catch (e) { console.log(`  ✗ ${ins.name} — ${e.message}`); }
  }
  console.log(`\nDone: ${ok}/${INSIGHTS.length} insights.`);
  console.log(`Open: ${HOST}/project/${projectId}/dashboard/${dash.id}`);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
