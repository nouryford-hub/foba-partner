/* FOBA Partner Portal – scripts.js */
/* Updated: März 2026 – v3.0 FINAL */

/* ─── STATE ─────────────────────────────────────────────────────── */
let _lastMRR   = 0;   // written by calculator, read by submitApplication
let _lastScore = 0;   // written by submitApplication for success routing

/* ─── REVENUE CALCULATOR ────────────────────────────────────────── */
function updateCalculator() {
    const newClients    = parseInt(document.getElementById('clientsSlider').value);
    const pricePerClient = parseInt(document.getElementById('priceSlider').value);
    const costPerClient  = parseInt(document.getElementById('tierSelect').value);

    document.getElementById('clientsVal').textContent = newClients;
    document.getElementById('priceVal').textContent   = pricePerClient.toLocaleString('de-DE') + ' €';

    let activeClients = 0;
    for (let month = 1; month <= 12; month++) {
        activeClients = Math.floor(activeClients * 0.95 + newClients);
    }

    const mrr      = Math.floor(activeClients * pricePerClient);
    const fobaCost = Math.floor(activeClients * costPerClient) + (costPerClient === 200 ? 490 : 0);
    const marge    = mrr - fobaCost;
    const threeYears = Math.floor(mrr * 12 * 2.8);

    _lastMRR = mrr; // persist for webhook payload

    document.getElementById('outClients').textContent  = activeClients;
    document.getElementById('outMRR').textContent      = mrr.toLocaleString('de-DE') + ' €';
    document.getElementById('outCost').textContent     = fobaCost.toLocaleString('de-DE') + ' €';
    document.getElementById('outMarge').textContent    = marge.toLocaleString('de-DE') + ' €';
    document.getElementById('out3Years').textContent   = (threeYears / 1000000).toFixed(2) + 'M €';
}

document.getElementById('clientsSlider').addEventListener('input',  updateCalculator);
document.getElementById('priceSlider').addEventListener('input',    updateCalculator);
document.getElementById('tierSelect').addEventListener('change',    updateCalculator);
updateCalculator();

/* ─── MODALS ────────────────────────────────────────────────────── */
function openModal(type) {
    document.getElementById('modal-overlay').style.display     = 'block';
    document.getElementById('modal-' + type).style.display     = 'block';
    document.body.style.overflow = 'hidden';
}
function closeModal() {
    document.getElementById('modal-overlay').style.display     = 'none';
    document.getElementById('modal-impressum').style.display   = 'none';
    document.getElementById('modal-datenschutz').style.display = 'none';
    document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ─── LEAD SCORING (client-side mirror of n8n logic) ───────────── */
/*  Used only to route the success state. Real scoring happens in n8n. */
function clientScoreLead(message, company, tier) {
    const combined = (message + ' ' + company).toLowerCase();
    const HIGH = ['mittelstand','industrie','fertigung','logistik','produktion',
                  'maschinenbau','erp','sap','automatisierung','prozess',
                  '10+ mitarbeiter','50 mitarbeiter','100 mitarbeiter',
                  'gmbh','ag','holding','gruppe','werk'];
    const MID  = ['agentur','beratung','consulting','digitalisierung',
                  'kunden','mrr','white-label','reseller'];
    let score = 0;
    HIGH.forEach(kw => { if (combined.includes(kw)) score += 10; });
    MID.forEach(kw  => { if (combined.includes(kw)) score += 5;  });
    if (tier === 'platin') score += 20;
    if (tier === 'gold')   score += 10;
    return score;
}

/* ─── SUCCESS STATE RENDERER ────────────────────────────────────── */
const CALENDLY_URL = 'https://calendly.com/fouad-bassy/priority-strategy-call';

function renderSuccessState(score, name) {
    const el = document.getElementById('successState');

    const highPriority = score > 20;

    el.innerHTML = `
        <div style="font-size:48px; margin-bottom:16px;">${highPriority ? '🔥' : '⚡'}</div>
        <div style="font-family:'Bebas Neue',sans-serif; font-size:40px; color:var(--orange);
                    letter-spacing:3px; margin-bottom:12px;">BEWERBUNG ERHALTEN</div>
        <div style="font-size:15px; color:var(--white2); line-height:1.6; max-width:480px; margin:0 auto;">
            Hey ${name}, deine Bewerbung ist bei uns angekommen.
        </div>
        ${highPriority ? `
        <!-- HIGH PRIORITY: Calendly CTA -->
        <div style="margin-top:32px; padding:20px; border:1px solid rgba(255,85,0,0.25);
                    background:rgba(255,85,0,0.06); max-width:460px; margin-left:auto; margin-right:auto;">
            <div style="font-size:11px; letter-spacing:2px; color:var(--orange);
                        font-family:'DM Mono',monospace; margin-bottom:8px;">PRIORITY LEAD — SOFORT-TERMIN VERFÜGBAR</div>
            <div style="font-size:14px; color:var(--white2); margin-bottom:20px; line-height:1.6;">
                Dein Profil passt hervorragend zu FOBA.<br>Buche jetzt direkt einen Strategy Call mit Fouad.
            </div>
            <a href="${CALENDLY_URL}" target="_blank" class="priority-cta">
                → PRIORITY STRATEGY CALL BUCHEN
            </a>
        </div>
        ` : `
        <!-- STANDARD: 48h message -->
        <div class="standard-msg">
            📅 &nbsp;Fouad Bassy meldet sich persönlich innerhalb von <strong style="color:var(--white);">48 Stunden</strong> bei dir.
        </div>
        `}
    `;
}

/* ─── APPLICATION SUBMIT ────────────────────────────────────────── */
const PARTNER_ID = new URLSearchParams(window.location.search).get('ref') || 'direct';

async function submitApplication() {
    // ── HoneyPot Guard ──────────────────────────────────────────
    if (document.getElementById('fWebsite').value !== '') return;

    // ── Validation ──────────────────────────────────────────────
    const name    = document.getElementById('fName').value.trim();
    const email   = document.getElementById('fEmail').value.trim();
    const company = document.getElementById('fCompany').value.trim();
    const tier    = document.getElementById('fTier').value;
    const message = document.getElementById('fMessage').value.trim();

    if (!name || !email) {
        alert('Bitte gib mindestens deinen Namen und deine E-Mail-Adresse ein.');
        return;
    }

    // ── Loading State ───────────────────────────────────────────
    const btn = document.getElementById('submitBtn');
    btn.disabled     = true;
    btn.textContent  = '⏳ Wird verarbeitet...';
    btn.style.opacity = '0.7';
    btn.style.cursor  = 'not-allowed';

    // ── Client-side score (for success routing) ─────────────────
    const score = clientScoreLead(message, company, tier);
    _lastScore = score;

    // ── Fire Webhook ─────────────────────────────────────────────
    try {
        await fetch('https://auto.foba.app/webhook/foba-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source:     'partner.foba.app',
                type:       'partner_application',
                partner_id: PARTNER_ID,
                name,
                company,
                email,
                tier,
                message,
                mrr_estimate: _lastMRR,   // calculator value
                client_score: score,       // pre-score for n8n
                timestamp:  new Date().toISOString()
            })
        });
    } catch(e) { console.warn('Webhook error:', e); }

    // ── Show Success ─────────────────────────────────────────────
    document.getElementById('formBody').style.display = 'none';
    const successEl = document.getElementById('successState');
    successEl.style.display = 'block';
    renderSuccessState(score, name);
    successEl.scrollIntoView({ behavior: 'smooth' });
}
