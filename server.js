import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createServer } from 'node:http';

const root = resolve(process.cwd());
const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
};

const server = createServer((request, response) => {
  let url;
  let requestedPath;

  try {
    url = new URL(request.url || '/', `http://${request.headers.host}`);
    requestedPath = normalize(decodeURIComponent(url.pathname)).replace(/^\.\.(\/|\\|$)/, '');
  } catch {
    response.writeHead(400);
    response.end('Bad Request');
    return;
  }

  let filePath = join(root, requestedPath === '/' ? 'index.html' : requestedPath);

  if (filePath !== root && !filePath.startsWith(rootPrefix)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    if (extname(filePath) || requestedPath.startsWith('/assets/')) {
      response.writeHead(404);
      response.end('Not Found');
      return;
    }

    filePath = join(root, 'index.html');
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  console.log(`French Numbers Mastery available at http://localhost:${port}`);
});
