const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { parseCookies, setCookie } = require('./utils');

const COOKIE_NAME = 'forum_session';
const SESSION_HOURS = 24;

function createSession(res, userId) {
  const d = db.get();
  d.run('DELETE FROM sessions WHERE user_id = ?', [userId]);

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();

  d.run('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', [sessionId, userId, expiresAt]);

  setCookie(res, COOKIE_NAME, sessionId, {
    path: '/',
    expires: new Date(expiresAt),
  });
}

function getUser(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies[COOKIE_NAME];
  if (!sessionId) return null;

  const d = db.get();
  const row = d.get(`
    SELECT u.id, u.email, u.username, s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `, [sessionId]);

  if (!row) return null;

  if (new Date(row.expires_at) < new Date()) {
    d.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
    return null;
  }

  return { id: row.id, email: row.email, username: row.username };
}

function destroySession(req, res) {
  const cookies = parseCookies(req);
  const sessionId = cookies[COOKIE_NAME];
  if (sessionId) {
    db.get().run('DELETE FROM sessions WHERE id = ?', [sessionId]);
  }
  setCookie(res, COOKIE_NAME, '', { path: '/', maxAge: 0 });
}

module.exports = { createSession, getUser, destroySession };
