/**
 * run.pay — Services Bundle
 * 5 vrais services fonctionnels :
 * 1. Web Scraper Pro
 * 2. PDF Generator
 * 3. Phone Validator
 * 4. Screenshot API
 * 5. Domain Enrichment
 */
 
import express from 'express';
 
const app = express();
app.use(express.json());
 
const RUNPAY_KEY = process.env.RUNPAY_KEY;
const PUBLIC_URL = process.env.PUBLIC_URL;
const API_BASE = 'https://runpay-backend-visibility-production.up.railway.app';
 
// ─── SECURITY ─────────────────────────────────────────────────────────────────
function verifyRunPay(req, res, next) {
  const callId = req.headers['x-runpay-call-id'];
  if (!callId) return res.status(403).json({ error: 'Unauthorized — only callable via run.pay' });
  next();
}
 
// ─── HEALTHCHECK ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'run.pay Services Bundle',
    version: '1.1.0',
    services: ['web-scraper', 'web-scraper-batch', 'pdf-generator', 'phone-validator', 'phone-validator-batch', 'screenshot', 'enrich'],
    status: 'ok'
  });
});
 
// ─── 1. WEB SCRAPER PRO (optimisé) ───────────────────────────────────────────
app.post('/scrape', verifyRunPay, async (req, res) => {
  const { url, extract = ['title', 'description', 'content', 'links', 'images', 'emails', 'og'] } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
 
  const startTime = Date.now();
 
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(15000)
    });
 
    if (!response.ok) throw new Error(`HTTP ${response.status} — ${response.statusText}`);
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
 
    const html = await response.text();
    const result = { success: true, url, load_time_ms: Date.now() - startTime };
 
    if (extract.includes('title')) {
      result.title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') || '';
    }
 
    if (extract.includes('description')) {
      result.description = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)?.[1] ||
        html.match(/<meta[^>]*content=["'](.*?)["'][^>]*name=["']description["']/i)?.[1] || '';
    }
 
    if (extract.includes('og')) {
      result.og = {
        title: html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["']/i)?.[1] || '',
        description: html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/i)?.[1] || '',
        image: html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["'](.*?)["']/i)?.[1] || '',
        type: html.match(/<meta[^>]*property=["']og:type["'][^>]*content=["'](.*?)["']/i)?.[1] || '',
      };
    }
 
    if (extract.includes('content')) {
      result.content = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ').trim().substring(0, 10000);
      result.word_count = result.content.split(/\s+/).length;
    }
 
    if (extract.includes('links')) {
      const allLinks = [...html.matchAll(/href=["'](https?:\/\/[^"'#?]+)["']/gi)].map(m => m[1]);
      result.links = [...new Set(allLinks)].slice(0, 30);
      result.internal_links = result.links.filter(l => l.includes(new URL(url).hostname)).slice(0, 15);
      result.external_links = result.links.filter(l => !l.includes(new URL(url).hostname)).slice(0, 15);
    }
 
    if (extract.includes('images')) {
      result.images = [...new Set([...html.matchAll(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|gif|webp|svg))["']/gi)].map(m => m[1]))].slice(0, 15);
    }
 
    if (extract.includes('emails')) {
      result.emails = [...new Set(html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])].filter(e => !e.includes('example') && !e.includes('test')).slice(0, 10);
    }
 
    if (extract.includes('phones')) {
      result.phones = [...new Set(html.match(/\+?[\d\s\-\.\(\)]{10,20}/g) || [])].filter(p => p.replace(/\D/g, '').length >= 9).slice(0, 10);
    }
 
    result.language = html.match(/<html[^>]*lang=["']([^"']+)["']/i)?.[1] || 'unknown';
    result.scraped_at = new Date().toISOString();
 
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, url, load_time_ms: Date.now() - startTime });
  }
});
 
// ─── 2. PDF GENERATOR (optimisé) ──────────────────────────────────────────────
app.post('/pdf', verifyRunPay, (req, res) => {
  const { title, content, type = 'document', data, theme = 'default', language = 'en' } = req.body;
  if (!title && !content && !data) return res.status(400).json({ error: 'title or content required' });
 
  const themes = {
    default: { primary: '#1a1a2e', accent: '#00e87a', bg: '#ffffff', text: '#333333' },
    dark:    { primary: '#ffffff', accent: '#00e87a', bg: '#1a1a2e', text: '#e8e8e8' },
    blue:    { primary: '#1e40af', accent: '#3b82f6', bg: '#ffffff', text: '#1f2937' },
    minimal: { primary: '#000000', accent: '#666666', bg: '#ffffff', text: '#333333' },
  };
  const t = themes[theme] || themes.default;
  const currency = data?.currency || '€';
  const dateLocale = language === 'fr' ? 'fr-FR' : 'en-US';
 
  const styles = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 48px; background: ${t.bg}; color: ${t.text}; line-height: 1.6; font-size: 14px; }
    h1 { color: ${t.primary}; font-size: 28px; border-bottom: 3px solid ${t.accent}; padding-bottom: 12px; margin-bottom: 24px; }
    h2 { color: ${t.primary}; font-size: 18px; margin: 28px 0 12px; }
    h3 { color: ${t.primary}; font-size: 15px; margin: 20px 0 8px; }
    p { margin-bottom: 12px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 32px; background: ${t.primary}10; padding: 16px; border-radius: 4px; }
    .meta-item { display: flex; flex-direction: column; gap: 4px; }
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: ${t.text}88; }
    .meta-value { font-weight: 600; color: ${t.primary}; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { background: ${t.primary}; color: ${t.bg}; padding: 12px 14px; text-align: left; font-size: 12px; letter-spacing: 0.5px; }
    td { padding: 11px 14px; border-bottom: 1px solid ${t.text}22; }
    tr:nth-child(even) td { background: ${t.primary}08; }
    .total-row td { font-weight: 700; background: ${t.accent}22; font-size: 15px; }
    .badge { background: ${t.accent}; color: #000; padding: 3px 10px; border-radius: 3px; font-size: 11px; font-weight: 600; }
    .highlight { background: ${t.accent}22; border-left: 4px solid ${t.accent}; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; }
    .footer { margin-top: 48px; padding-top: 14px; border-top: 1px solid ${t.text}22; font-size: 11px; color: ${t.text}66; display: flex; justify-content: space-between; }
    .status { display: inline-block; padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef9c3; color: #854d0e; }
  `;
 
  let body = '';
 
  if (type === 'invoice' && data) {
    const items = data.items || [];
    const subtotal = items.reduce((a, i) => a + (i.qty || 1) * (i.price || 0), 0);
    const tax = data.tax_rate ? subtotal * (data.tax_rate / 100) : 0;
    const total = subtotal + tax;
    const status = data.status || 'pending';
 
    body = `
      <div class="meta">
        <div class="meta-item"><span class="meta-label">Invoice</span><span class="meta-value">${data.invoice_number || 'INV-001'}</span></div>
        <div class="meta-item"><span class="meta-label">Date</span><span class="meta-value">${data.date || new Date().toLocaleDateString(dateLocale)}</span></div>
        <div class="meta-item"><span class="meta-label">Due Date</span><span class="meta-value">${data.due_date || 'Upon receipt'}</span></div>
        <div class="meta-item"><span class="meta-label">Status</span><span class="status status-${status}">${status.toUpperCase()}</span></div>
      </div>
      ${data.from ? `<div style="margin-bottom:20px"><strong>From:</strong><br>${data.from.split(String.fromCharCode(10)).join('<br>')}</div>` : ''}
      ${data.client ? `<div style="margin-bottom:28px"><strong>Bill To:</strong><br>${data.client.split(String.fromCharCode(10)).join('<br>')}</div>` : ''}
      <table>
        <tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr>
        ${items.map(i => `<tr><td>${i.description}${i.note?`<br><small style="color:#888">${i.note}</small>`:''}</td><td style="text-align:center">${i.qty||1}</td><td style="text-align:right">${(i.price||0).toFixed(2)}${currency}</td><td style="text-align:right">${((i.qty||1)*(i.price||0)).toFixed(2)}${currency}</td></tr>`).join('')}
        <tr><td colspan="3" style="text-align:right;padding-top:8px">Subtotal</td><td style="text-align:right;padding-top:8px">${subtotal.toFixed(2)}${currency}</td></tr>
        ${tax > 0 ? `<tr><td colspan="3" style="text-align:right">Tax (${data.tax_rate}%)</td><td style="text-align:right">${tax.toFixed(2)}${currency}</td></tr>` : ''}
        <tr class="total-row"><td colspan="3" style="text-align:right">TOTAL</td><td style="text-align:right">${total.toFixed(2)}${currency}</td></tr>
      </table>
      ${data.notes ? `<div class="highlight"><strong>Notes:</strong><br>${data.notes}</div>` : ''}
      ${data.payment_info ? `<div style="margin-top:20px"><strong>Payment Info:</strong><br>${data.payment_info.split(String.fromCharCode(10)).join('<br>')}</div>` : ''}
    `;
  } else if (type === 'report') {
    const sections = data?.sections || [];
    body = `
      ${data?.summary ? `<div class="highlight">${data.summary}</div>` : ''}
      ${data?.stats ? `<div class="meta">${Object.entries(data.stats).map(([k,v]) => `<div class="meta-item"><span class="meta-label">${k}</span><span class="meta-value">${v}</span></div>`).join('')}</div>` : ''}
      ${sections.map(s => `<h2>${s.title}</h2>${s.highlight ? `<div class="highlight">${s.highlight}</div>` : ''}<p>${s.content}</p>${s.items ? `<ul style="margin:8px 0 12px 20px">${s.items.map(i=>`<li>${i}</li>`).join('')}</ul>` : ''}`).join('')}
      ${content ? `<p>${content}</p>` : ''}
    `;
  } else if (type === 'contract') {
    body = `
      ${data?.parties ? `<div class="meta">${data.parties.map(p=>`<div class="meta-item"><span class="meta-label">${p.role}</span><span class="meta-value">${p.name}</span></div>`).join('')}</div>` : ''}
      ${content ? content.split(String.fromCharCode(10)).map(p => '<p>'+p+'</p>').join('') : ''}
      ${data?.clauses ? data.clauses.map((c,i) => `<h3>${i+1}. ${c.title}</h3><p>${c.content}</p>`).join('') : ''}
      ${data?.signatures ? `<div style="margin-top:48px;display:flex;gap:48px">${data.signatures.map(s=>`<div style="flex:1;border-top:2px solid #333;padding-top:8px"><strong>${s.name}</strong><br><small>${s.role}</small><br><small>${s.date||'Date: ________________'}</small></div>`).join('')}</div>` : ''}
    `;
  } else {
    body = content ? content.split(String.fromCharCode(10)).map(p => '<p>'+p+'</p>').join('') : '<pre>'+JSON.stringify(data||{},null,2)+'</pre>';
  }
 
  const html = `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="UTF-8">
<title>${title || 'Document'}</title>
<style>${styles}</style>
</head>
<body>
<h1>${title || 'Document'}</h1>
${body}
<div class="footer">
  <span>Generated by <span class="badge">run.pay</span> PDF Generator</span>
  <span>${new Date().toLocaleDateString(dateLocale)} ${new Date().toLocaleTimeString(dateLocale)}</span>
</div>
</body>
</html>`;
 
  res.json({
    success: true,
    title: title || 'Document',
    type,
    theme,
    html,
    html_base64: Buffer.from(html).toString('base64'),
    size_bytes: Buffer.byteLength(html),
    generated_at: new Date().toISOString()
  });
});
 
// ─── 3. PHONE VALIDATOR (optimisé) ───────────────────────────────────────────
app.post('/phone', verifyRunPay, (req, res) => {
  const { phone, country_hint } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
 
  const cleaned = String(phone).replace(/[\s\-\.\(\)]/g, '');
 
  const prefixes = {
    '+33': { country:'France', code:'FR', trunk:'0', mobile:['06','07'], landline:['01','02','03','04','05'], special:['08','09'] },
    '+1':  { country:'USA/Canada', code:'US', trunk:'', mobile:[], landline:[], special:[] },
    '+44': { country:'United Kingdom', code:'GB', trunk:'0', mobile:['07'], landline:['01','02','03'], special:['08','09'] },
    '+49': { country:'Germany', code:'DE', trunk:'0', mobile:['015','016','017'], landline:[], special:[] },
    '+34': { country:'Spain', code:'ES', trunk:'', mobile:['6','7'], landline:['9'], special:[] },
    '+39': { country:'Italy', code:'IT', trunk:'', mobile:['3'], landline:['0'], special:['8'] },
    '+32': { country:'Belgium', code:'BE', trunk:'0', mobile:['04'], landline:['0'], special:['08'] },
    '+41': { country:'Switzerland', code:'CH', trunk:'0', mobile:['075','076','077','078','079'], landline:[], special:[] },
    '+31': { country:'Netherlands', code:'NL', trunk:'0', mobile:['06'], landline:[], special:[] },
    '+212': { country:'Morocco', code:'MA', trunk:'0', mobile:['06','07'], landline:['05'], special:[] },
    '+213': { country:'Algeria', code:'DZ', trunk:'0', mobile:['05','06','07'], landline:[], special:[] },
    '+216': { country:'Tunisia', code:'TN', trunk:'', mobile:['2','5','9'], landline:['7'], special:[] },
    '+971': { country:'UAE', code:'AE', trunk:'0', mobile:['05'], landline:['04'], special:[] },
    '+966': { country:'Saudi Arabia', code:'SA', trunk:'0', mobile:['05'], landline:[], special:[] },
    '+91':  { country:'India', code:'IN', trunk:'0', mobile:[], landline:[], special:[] },
    '+86':  { country:'China', code:'CN', trunk:'0', mobile:[], landline:[], special:[] },
    '+81':  { country:'Japan', code:'JP', trunk:'0', mobile:['070','080','090'], landline:[], special:[] },
    '+55':  { country:'Brazil', code:'BR', trunk:'0', mobile:[], landline:[], special:[] },
    '+52':  { country:'Mexico', code:'MX', trunk:'0', mobile:[], landline:[], special:[] },
    '+27':  { country:'South Africa', code:'ZA', trunk:'0', mobile:['06','07','08'], landline:[], special:[] },
    '+20':  { country:'Egypt', code:'EG', trunk:'0', mobile:['010','011','012','015'], landline:[], special:[] },
    '+7':   { country:'Russia', code:'RU', trunk:'8', mobile:['9'], landline:[], special:[] },
    '+351': { country:'Portugal', code:'PT', trunk:'', mobile:['9'], landline:['2'], special:[] },
    '+48':  { country:'Poland', code:'PL', trunk:'0', mobile:['5','6','7','8'], landline:[], special:[] },
    '+30':  { country:'Greece', code:'GR', trunk:'', mobile:['69'], landline:['2'], special:[] },
    '+90':  { country:'Turkey', code:'TR', trunk:'0', mobile:['05'], landline:[], special:[] },
  };
 
  let detected = null, prefix = null;
  const sorted = Object.entries(prefixes).sort((a,b) => b[0].length - a[0].length);
  for (const [p, info] of sorted) {
    if (cleaned.startsWith(p)) { detected = info; prefix = p; break; }
  }
 
  let lineType = 'unknown';
  if (detected) {
    const local = detected.trunk ? cleaned.replace(prefix, detected.trunk) : cleaned.replace(prefix, '');
    if (detected.mobile.some(m => local.startsWith(m))) lineType = 'mobile';
    else if (detected.landline.some(m => local.startsWith(m))) lineType = 'landline';
    else if (detected.special.some(m => local.startsWith(m))) lineType = 'special/voip';
    else lineType = 'unknown';
  }
 
  const digits = cleaned.replace('+', '').replace(/\D/g,'').length;
  const isValid = digits >= 7 && digits <= 15 && /^\+?[0-9]+$/.test(cleaned);
  const e164 = cleaned.startsWith('+') ? cleaned : '+' + cleaned.replace(/\D/g,'');
 
  let localFormat = '';
  if (detected?.code === 'FR') {
    const local = '0' + cleaned.replace('+33', '');
    localFormat = local.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  } else if (detected?.code === 'US') {
    const num = cleaned.replace('+1', '');
    localFormat = num.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  }
 
  res.json({
    success: true,
    input: phone,
    e164,
    local_format: localFormat || e164,
    is_valid: isValid,
    country: detected?.country || 'Unknown',
    country_code: detected?.code || 'XX',
    country_prefix: prefix || 'unknown',
    line_type: lineType,
    digits,
    risk_level: lineType === 'special/voip' ? 'medium' : (isValid ? 'low' : 'high'),
    validated_at: new Date().toISOString()
  });
});
 
// ─── 4. SCREENSHOT API (optimisé) ────────────────────────────────────────────
app.post('/screenshot', verifyRunPay, async (req, res) => {
  const { url, width = 1280, height = 800, mobile = false, format = 'png', full_page = false } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
 
  try {
    let siteAccessible = false;
    let statusCode = null;
    let responseTime = null;
    
    try {
      const startTime = Date.now();
      const check = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; run.pay Screenshot Bot)' }
      });
      responseTime = Date.now() - startTime;
      statusCode = check.status;
      siteAccessible = check.ok;
    } catch(e) {
      siteAccessible = false;
    }
 
    const deviceWidth = mobile ? 375 : width;
    const deviceHeight = mobile ? 812 : height;
    
    const screenshotUrl = `https://image.thum.io/get/width/${deviceWidth}/crop/${deviceHeight}${full_page ? '/fullpage' : ''}/${url}`;
    const thumbnailUrl = `https://image.thum.io/get/width/400/crop/300/${url}`;
    const ogImageUrl = `https://image.thum.io/get/og/${url}`;
 
    let domain = '';
    try { domain = new URL(url).hostname; } catch(e) {}
 
    res.json({
      success: true,
      url,
      domain,
      screenshot_url: screenshotUrl,
      thumbnail_url: thumbnailUrl,
      og_image_url: ogImageUrl,
      viewport: { 
        width: deviceWidth, 
        height: deviceHeight, 
        device: mobile ? 'mobile' : 'desktop',
        full_page
      },
      format: format.toUpperCase(),
      site_info: {
        accessible: siteAccessible,
        status_code: statusCode,
        response_time_ms: responseTime
      },
      usage: {
        embed: `<img src="${screenshotUrl}" alt="Screenshot of ${domain}" />`,
        markdown: `![Screenshot of ${domain}](${screenshotUrl})`,
        direct_url: screenshotUrl
      },
      taken_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, url });
  }
});
 
 
// ─── 5. PHONE VALIDATOR BATCH ─────────────────────────────────────────────────
app.post('/phone-batch', verifyRunPay, async (req, res) => {
  const { phones } = req.body;
  if (!phones || !Array.isArray(phones)) return res.status(400).json({ error: 'phones array required' });
  if (phones.length > 1000) return res.status(400).json({ error: 'Maximum 1000 numbers per batch' });
  if (phones.length === 0) return res.status(400).json({ error: 'phones array is empty' });
 
  const prefixes = {
    '+33':{ country:'France', code:'FR' },
    '+1': { country:'USA/Canada', code:'US' },
    '+44':{ country:'United Kingdom', code:'GB' },
    '+49':{ country:'Germany', code:'DE' },
    '+34':{ country:'Spain', code:'ES' },
    '+39':{ country:'Italy', code:'IT' },
    '+32':{ country:'Belgium', code:'BE' },
    '+41':{ country:'Switzerland', code:'CH' },
    '+31':{ country:'Netherlands', code:'NL' },
    '+212':{ country:'Morocco', code:'MA' },
    '+213':{ country:'Algeria', code:'DZ' },
    '+216':{ country:'Tunisia', code:'TN' },
    '+971':{ country:'UAE', code:'AE' },
    '+966':{ country:'Saudi Arabia', code:'SA' },
    '+91': { country:'India', code:'IN' },
    '+86': { country:'China', code:'CN' },
    '+81': { country:'Japan', code:'JP' },
    '+55': { country:'Brazil', code:'BR' },
    '+52': { country:'Mexico', code:'MX' },
  };
 
  function validatePhone(phone) {
    const cleaned = String(phone).replace(/[\s\-\.\(\)]/g, '');
    let detected = null, prefix = null;
    for (const [p, info] of Object.entries(prefixes)) {
      if (cleaned.startsWith(p)) { detected = info; prefix = p; break; }
    }
    let lineType = 'unknown';
    if (detected?.code === 'FR') {
      const local = cleaned.replace('+33', '0');
      if (local.startsWith('06') || local.startsWith('07')) lineType = 'mobile';
      else if (/^0[1-5]/.test(local)) lineType = 'landline';
      else if (local.startsWith('08')) lineType = 'special';
    } else if (detected?.code === 'US') {
      lineType = 'mobile/landline';
    }
    const isValid = cleaned.length >= 8 && cleaned.length <= 15 && /^\+?[0-9]+$/.test(cleaned);
    const e164 = cleaned.startsWith('+') ? cleaned : '+' + cleaned;
    return {
      input: phone,
      e164,
      is_valid: isValid,
      country: detected?.country || 'Unknown',
      country_code: detected?.code || 'XX',
      country_prefix: prefix || 'unknown',
      line_type: lineType,
      digits: cleaned.replace('+', '').length
    };
  }
 
  const results = phones.map(validatePhone);
  const valid = results.filter(r => r.is_valid).length;
  const invalid = results.filter(r => !r.is_valid).length;
  const byCountry = {};
  results.forEach(r => { byCountry[r.country] = (byCountry[r.country] || 0) + 1; });
 
  res.json({
    success: true,
    total: phones.length,
    valid,
    invalid,
    by_country: byCountry,
    results,
    processed_at: new Date().toISOString()
  });
});
 
// ─── 6. WEB SCRAPER BATCH ─────────────────────────────────────────────────────
app.post('/scrape-batch', verifyRunPay, async (req, res) => {
  const { urls, extract = ['title', 'content', 'links'] } = req.body;
  if (!urls || !Array.isArray(urls)) return res.status(400).json({ error: 'urls array required' });
  if (urls.length > 10) return res.status(400).json({ error: 'Maximum 10 URLs per batch' });
  if (urls.length === 0) return res.status(400).json({ error: 'urls array is empty' });
 
  async function scrapeOne(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const html = await response.text();
 
      const result = { url, success: true };
 
      if (extract.includes('title')) {
        result.title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || '';
      }
      if (extract.includes('description')) {
        result.description = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)?.[1] || '';
      }
      if (extract.includes('content')) {
        result.content = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ').trim().substring(0, 5000);
      }
      if (extract.includes('links')) {
        result.links = [...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)]
          .map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 15);
      }
      if (extract.includes('images')) {
        result.images = [...html.matchAll(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|gif|webp))["']/gi)]
          .map(m => m[1]).slice(0, 5);
      }
      if (extract.includes('emails')) {
        result.emails = [...new Set(html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])].slice(0, 10);
      }
 
      return result;
    } catch (err) {
      return { url, success: false, error: err.message };
    }
  }
 
  const results = await Promise.all(urls.map(scrapeOne));
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
 
  res.json({
    success: true,
    total: urls.length,
    successful,
    failed,
    results,
    scraped_at: new Date().toISOString()
  });
});
 
// ─── 7. DOMAIN / COMPANY ENRICHMENT (nouveau) ─────────────────────────────────
app.post('/enrich', verifyRunPay, async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain required' });
 
  let cleanDomain = String(domain).trim().toLowerCase();
  cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  const url = `https://${cleanDomain}`;
 
  const startTime = Date.now();
 
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; run.pay enrichment bot)' },
      signal: AbortSignal.timeout(8000)
    });
 
    const html = await response.text();
    const headers = Object.fromEntries(response.headers.entries());
    const responseTime = Date.now() - startTime;
 
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;
 
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : null;
 
    const ogSiteMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
    const companyName = ogSiteMatch ? ogSiteMatch[1].trim() : (title ? title.split(/[-|–]/)[0].trim() : null);
 
    const socialPatterns = {
      twitter: /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i,
      linkedin: /linkedin\.com\/company\/([a-zA-Z0-9-]+)/i,
      facebook: /facebook\.com\/([a-zA-Z0-9.]+)/i,
      instagram: /instagram\.com\/([a-zA-Z0-9_.]+)/i,
      github: /github\.com\/([a-zA-Z0-9-]+)/i
    };
 
    const socials = {};
    for (const [platform, pattern] of Object.entries(socialPatterns)) {
      const match = html.match(pattern);
      if (match) socials[platform] = match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
    }
 
    const techSignatures = {
      'React': /react|_next\/static|__NEXT_DATA__/i,
      'Vue.js': /vue\.js|__vue__/i,
      'WordPress': /wp-content|wp-includes/i,
      'Shopify': /cdn\.shopify\.com|shopify/i,
      'Webflow': /webflow\.com|wf-page/i,
      'Squarespace': /squarespace\.com/i,
      'HubSpot': /hubspot|hs-scripts/i,
      'Google Analytics': /google-analytics\.com|gtag\(/i,
      'Stripe': /js\.stripe\.com/i,
      'Intercom': /widget\.intercom\.io/i,
      'Cloudflare': /cloudflare/i
    };
 
    const technologies = [];
    const fullText = html + JSON.stringify(headers);
    for (const [tech, pattern] of Object.entries(techSignatures)) {
      if (pattern.test(fullText)) technologies.push(tech);
    }
 
    const server = headers['server'] || null;
 
    res.json({
      success: true,
      domain: cleanDomain,
      company_name: companyName,
      title: title,
      description: description,
      technologies: technologies,
      server: server,
      social_profiles: socials,
      site_accessible: true,
      status_code: response.status,
      response_time_ms: responseTime,
      enriched_at: new Date().toISOString()
    });
 
  } catch (error) {
    res.json({
      success: false,
      domain: cleanDomain,
      site_accessible: false,
      error: error.message,
      enriched_at: new Date().toISOString()
    });
  }
});
 
// ─── AUTO-PUBLISH SUR RUN.PAY ─────────────────────────────────────────────────
async function publishServices() {
  if (!RUNPAY_KEY || !PUBLIC_URL) {
    console.log('⚠️  RUNPAY_KEY ou PUBLIC_URL manquant — services non publiés automatiquement');
    console.log('   Ajoute ces variables dans Railway et redéploie.');
    return;
  }
 
  const services = [
    {
      name: 'Web Scraper Pro',
      description: 'Extract text, title, links and images from any public URL. Returns clean structured JSON.',
      endpoint_url: `${PUBLIC_URL}/scrape`,
      price_per_call: 0.005,
      category: 'DATA'
    },
    {
      name: 'PDF Generator',
      description: 'Generate professional PDFs from JSON. Supports invoices, reports and custom documents. Returns HTML renderable as PDF.',
      endpoint_url: `${PUBLIC_URL}/pdf`,
      price_per_call: 0.008,
      category: 'AI'
    },
    {
      name: 'Phone Validator',
      description: 'Validate phone numbers worldwide. Returns country, line type (mobile/landline) and E164 format.',
      endpoint_url: `${PUBLIC_URL}/phone`,
      price_per_call: 0.002,
      category: 'DATA'
    },
    {
      name: 'Screenshot API',
      description: 'Capture any website as PNG. Custom viewport dimensions supported. Instant results.',
      endpoint_url: `${PUBLIC_URL}/screenshot`,
      price_per_call: 0.015,
      category: 'MEDIA'
    },
    {
      name: 'Domain Enrichment',
      description: 'Enrich a domain with company name, description, tech stack detected, and linked social profiles. Real data scraped from the public site — no guesses.',
      endpoint_url: `${PUBLIC_URL}/enrich`,
      price_per_call: 0.60,
      category: 'DATA'
    }
  ];
 
  console.log('📡 Publication des services sur run.pay...');
  for (const service of services) {
    try {
      const res = await fetch(`${API_BASE}/api/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': RUNPAY_KEY },
        body: JSON.stringify(service)
      });
      const data = await res.json();
      if (data.service_id) console.log(`✅ ${service.name} publié`);
      else console.log(`⚠️  ${service.name}: ${data.error}`);
    } catch (err) {
      console.error(`❌ ${service.name}:`, err.message);
    }
  }
}
 
// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('run.pay Services Bundle v1.1 — Port ' + PORT + ' — Ready');
  console.log('Routes: /scrape /pdf /phone /screenshot /enrich');
});
 
