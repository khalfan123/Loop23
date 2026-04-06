import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile } from "fs/promises";

const allowlist = [
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

const forceExternals = [
  "@replit/vite-plugin-runtime-error-modal",
  "@replit/vite-plugin-cartographer",
  "@replit/vite-plugin-dev-banner",
  "vite",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = [
    ...allDeps.filter((dep) => !allowlist.includes(dep)),
    ...forceExternals,
  ];

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: "dist/index.mjs",
    banner: {
      js: [
        'import { createRequire } from "module";',
        'const require = createRequire(import.meta.url);',
      ].join("\n"),
    },
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  await writeFile(
    "dist/index.cjs",
    'import("./index.mjs").catch(e => { console.error(e); process.exit(1); });\n'
  );
  console.log("wrote dist/index.cjs ESM loader wrapper");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
