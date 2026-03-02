import type { NextConfig } from "next";
import path from "path";

const uiRoot = process.env.NEXT_RESOLVE_ROOT
  ? path.resolve(process.env.NEXT_RESOLVE_ROOT)
  : path.resolve(process.cwd());

const nextConfig: NextConfig = {
  // app/api/cuaderno/[...path]/route.ts maneja /api/cuaderno/* con timeout de 5 min (chat/execute).
  // NO usar rewrite para /api/cuaderno: el proxy por defecto tiene timeout corto y provoca
  // ECONNRESET cuando GPT tarda. La ruta API tiene prioridad si no hay rewrite.
  async rewrites() {
    return [
      // Solo reescribir paths que NO sean /api/cuaderno (ej. /api/session si existiera)
      {
        source: "/api/session/:path*",
        destination: "http://localhost:8000/api/session/:path*",
      },
    ];
  },
  // Turbopack (Next 16): fijar root para que resuelva tailwindcss desde cuaderno-ui
  turbopack: {
    root: uiRoot,
  },
  // Webpack (fallback): forzar resolución desde cuaderno-ui
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.modules = [path.join(uiRoot, "node_modules"), "node_modules"];
    return config;
  },
};

export default nextConfig;
