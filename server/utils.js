const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ── Cookie helpers ──
function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach(pair => {
    const [name, ...rest] = pair.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  parts.push('HttpOnly');
  parts.push('SameSite=Lax');
  const existing = res.getHeader('Set-Cookie') || [];
  const arr = Array.isArray(existing) ? existing : (existing ? [existing] : []);
  arr.push(parts.join('; '));
  res.setHeader('Set-Cookie', arr);
}

// ── URL-encoded body parser ──
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => {
      chunks.push(chunk);
      if (chunks.reduce((a, c) => a + c.length, 0) > 25 * 1024 * 1024) {
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(body);
        const obj = {};
        for (const [k, v] of params) {
          if (obj[k]) {
            if (Array.isArray(obj[k])) obj[k].push(v);
            else obj[k] = [obj[k], v];
          } else {
            obj[k] = v;
          }
        }
        resolve(obj);
      } else if (ct.includes('application/json')) {
        try { resolve(JSON.parse(body)); }
        catch { resolve({}); }
      } else {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

// ── Multipart form parser (for image uploads) ──
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    const match = ct.match(/boundary=(.+)/);
    if (!match) return reject(new Error('No boundary'));

    const boundary = match[1];
    const chunks = [];

    req.on('data', chunk => {
      chunks.push(chunk);
      if (chunks.reduce((a, c) => a + c.length, 0) > 25 * 1024 * 1024) {
        reject(new Error('File too large'));
      }
    });

    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const parts = parseMultipartBuffer(buffer, boundary);
      resolve(parts);
    });
    req.on('error', reject);
  });
}

function parseMultipartBuffer(buffer, boundary) {
  const results = { fields: {}, files: {} };
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(buffer, boundaryBuffer);

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.length < 4) continue;

    // Remove leading \r\n
    let start = 0;
    if (part[0] === 0x0d && part[1] === 0x0a) start = 2;

    const headerEnd = bufferIndexOf(part, Buffer.from('\r\n\r\n'), start);
    if (headerEnd === -1) continue;

    const headerStr = part.slice(start, headerEnd).toString();
    const bodyStart = headerEnd + 4;

    // Remove trailing \r\n--
    let bodyEnd = part.length;
    if (part[bodyEnd - 2] === 0x0d && part[bodyEnd - 1] === 0x0a) bodyEnd -= 2;

    const body = part.slice(bodyStart, bodyEnd);

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]*)"/);

    if (!nameMatch) continue;
    const fieldName = nameMatch[1];

    if (filenameMatch && filenameMatch[1]) {
      const filename = filenameMatch[1];
      const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i);
      results.files[fieldName] = {
        filename,
        contentType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream',
        data: body,
      };
    } else {
      const val = body.toString();
      if (results.fields[fieldName]) {
        if (Array.isArray(results.fields[fieldName])) results.fields[fieldName].push(val);
        else results.fields[fieldName] = [results.fields[fieldName], val];
      } else {
        results.fields[fieldName] = val;
      }
    }
  }
  return results;
}

function splitBuffer(buffer, delimiter) {
  const parts = [];
  let start = 0;
  while (true) {
    const idx = bufferIndexOf(buffer, delimiter, start);
    if (idx === -1) {
      parts.push(buffer.slice(start));
      break;
    }
    parts.push(buffer.slice(start, idx));
    start = idx + delimiter.length;
  }
  return parts;
}

function bufferIndexOf(buf, search, offset = 0) {
  for (let i = offset; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}

// ── Simple template engine ──
function renderTemplate(templateName, data = {}) {
  const layoutPath = path.join(__dirname, '..', 'templates', 'layout.html');
  const pagePath = path.join(__dirname, '..', 'templates', `${templateName}.html`);

  let layout = fs.readFileSync(layoutPath, 'utf8');
  let page = fs.readFileSync(pagePath, 'utf8');

  // Replace {{> content}} in layout with page content
  let html = layout.replace('{{> content}}', page);

  // Handle {{#if var}} ... {{else}} ... {{/if}}
  html = html.replace(/\{\{#if\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName, block) => {
    const val = resolveVar(data, varName);
    const [ifBlock, elseBlock] = block.split('{{else}}');
    if (val && (!Array.isArray(val) || val.length > 0)) {
      return ifBlock || '';
    }
    return elseBlock || '';
  });

  // Handle {{#each var}} ... {{/each}}
  html = html.replace(/\{\{#each\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, varName, block) => {
    const arr = resolveVar(data, varName);
    if (!Array.isArray(arr)) return '';
    return arr.map((item, index) => {
      let rendered = block;
      // Replace {{this.prop}} or {{prop}} within each
      rendered = rendered.replace(/\{\{(?:this\.)?(\w+(?:\.\w+)*)\}\}/g, (_, prop) => {
        if (prop === '@index') return index;
        const val = resolveVar(item, prop);
        return escapeHtml(val != null ? String(val) : '');
      });
      // Handle nested #if inside each
      rendered = rendered.replace(/\{\{#if\s+(?:this\.)?(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, vn, blk) => {
        const v = resolveVar(item, vn);
        const [ib, eb] = blk.split('{{else}}');
        if (v && (!Array.isArray(v) || v.length > 0)) return ib || '';
        return eb || '';
      });
      return rendered;
    }).join('');
  });

  // Replace {{var}} with escaped values
  html = html.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, varName) => {
    const val = resolveVar(data, varName);
    return escapeHtml(val != null ? String(val) : '');
  });

  // Replace {{{var}}} with raw (unescaped) values
  html = html.replace(/\{\{\{(\w+(?:\.\w+)*)\}\}\}/g, (_, varName) => {
    const val = resolveVar(data, varName);
    return val != null ? String(val) : '';
  });

  return html;
}

function resolveVar(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ── Static file server ──
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

function serveStatic(req, res) {
  const url = req.url.split('?')[0];
  const filePath = path.join(__dirname, '..', url);
  const ext = path.extname(filePath);

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

// ── Query string parser ──
function parseQuery(url) {
  const qIndex = url.indexOf('?');
  if (qIndex === -1) return {};
  const params = new URLSearchParams(url.slice(qIndex + 1));
  const obj = {};
  for (const [k, v] of params) {
    if (obj[k]) {
      if (Array.isArray(obj[k])) obj[k].push(v);
      else obj[k] = [obj[k], v];
    } else {
      obj[k] = v;
    }
  }
  return obj;
}

// ── Response helpers ──
function sendHTML(res, html, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function redirect(res, location, status = 303) {
  res.writeHead(status, { Location: location });
  res.end();
}

module.exports = {
  parseCookies, setCookie,
  parseBody, parseMultipart,
  renderTemplate, escapeHtml,
  serveStatic, parseQuery,
  sendHTML, sendJSON, redirect,
};
