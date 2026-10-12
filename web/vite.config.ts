import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
export default defineConfig({
  base: './', plugins: [react(), {
    name: 'same-runtime-manifest-in-development',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? '';
        if (!/^\/(imd-deployment\.json|abi\/[A-Za-z]+\.json)$/.test(pathname)) return next();
        try {
          const bytes = await readFile(new URL(`../dist${pathname}`, import.meta.url));
          res.setHeader('Content-Type', 'application/json'); res.end(bytes);
        } catch { res.statusCode = 503; res.end('Run npm run build first to generate the runtime deployment configuration.'); }
      });
    },
  }],
  build: { outDir: '../dist', emptyOutDir: true, sourcemap: false },
});
