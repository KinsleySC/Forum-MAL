const http = require('http');
const db = require('./database');
const Router = require('./router');
const auth = require('./auth');
const posts = require('./posts');
const { serveStatic, renderTemplate, sendHTML } = require('./utils');
const sessionMgr = require('./session');

const PORT = process.env.PORT || 4300;

async function start() {
await db.init();

const router = new Router();
router.get('/register', auth.registerPage);
router.post('/register', auth.registerSubmit);
router.get('/login', auth.loginPage);
router.post('/login', auth.loginSubmit);
router.get('/logout', auth.logout);
router.get('/', posts.homePage);
router.get('/post/new', posts.createPostPage);
router.post('/post/new', posts.createPostSubmit);
router.get('/post/:id', (req, res, params) => posts.viewPost(req, res, params));
router.get('/post/:id/edit', (req, res, params) => posts.editPostPage(req, res, params));
router.post('/post/:id/edit', (req, res, params) => posts.editPostSubmit(req, res, params));
router.post('/post/:id/delete', (req, res, params) => posts.deletePost(req, res, params));
router.post('/post/:id/comment', (req, res, params) => posts.addComment(req, res, params));
router.post('/comment/:id/edit', (req, res, params) => posts.editComment(req, res, params));
router.post('/comment/:id/delete', (req, res, params) => posts.deleteComment(req, res, params));
router.post('/vote/:type/:id', (req, res, params) => posts.vote(req, res, params));
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/static/')) {
      if (serveStatic(req, res)) return;
    }

    const match = router.resolve(req.method, req.url);
    if (match) {
      await match.handler(req, res, match.params);
    } else {
      const user = sessionMgr.getUser(req);
      const html = renderTemplate('error', { user, error: { code: 404, message: 'Page introuvable' } });
      sendHTML(res, html, 404);
    }
  } catch (err) {
    console.error('Server error:', err);
    const user = sessionMgr.getUser(req);
    try {
      const html = renderTemplate('error', { user, error: { code: 500, message: 'Erreur interne du serveur' } });
      sendHTML(res, html, 500);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }
});

server.listen(PORT, () => {
  console.log(`Forum running at http://localhost:${PORT}`);
});
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
