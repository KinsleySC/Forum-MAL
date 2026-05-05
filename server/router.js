class Router {
  constructor() {
    this.routes = [];
  }

  add(method, path, handler) {
    // Convert path params like :id to regex groups
    const paramNames = [];
    const pattern = path.replace(/:([a-zA-Z_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    this.routes.push({
      method: method.toUpperCase(),
      regex: new RegExp(`^${pattern}$`),
      paramNames,
      handler,
    });
  }

  get(path, handler) { this.add('GET', path, handler); }
  post(path, handler) { this.add('POST', path, handler); }

  resolve(method, url) {
    const [pathname] = url.split('?');
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) continue;
      const match = pathname.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}

module.exports = Router;
