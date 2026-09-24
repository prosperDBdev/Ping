# Build the Next.js app and ship only what it needs to run.
#
# Mirrors the backend's multi-stage approach for the same reason: the toolchain
# that compiles this app — TypeScript, ESLint, every devDependency — has no job
# at runtime, and anything left in the final image is both weight to move and
# surface to attack.

FROM node:22-alpine AS deps
WORKDIR /app
# Only the manifests, so this layer's cache survives every source edit and
# dependencies are re-resolved only when the lockfile actually changes.
COPY package.json package-lock.json ./
# `npm ci` rather than `npm install`: it installs exactly what the lockfile
# pins and fails if the two disagree, instead of quietly resolving something
# newer. A build should produce the same thing today and in six months.
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# THE IMPORTANT PART. NEXT_PUBLIC_* variables are substituted into the
# JavaScript bundle during `next build` — they are not read at runtime. Passing
# them as container environment variables would do nothing at all; the values
# have to be present HERE, while the bundle is being written. That is why they
# are build arguments.
#
# The consequence to remember: changing the domain means rebuilding this image,
# not just restarting the container.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as a normal user, not root. If anything ever escapes the Node process,
# it lands as an account that owns nothing rather than as root inside the
# container.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# `output: "standalone"` produces a self-contained server plus a pruned
# node_modules — but it deliberately leaves out two things, so they are copied
# separately. Miss either and the site loads with no styling and no icons:
#   public/       — your service worker, offline page and icons
#   .next/static  — the compiled CSS and JS chunks
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# HOSTNAME must be 0.0.0.0, not the default localhost. A server listening on
# localhost inside a container is reachable only from inside that container —
# nginx on the host would get connection refused.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
