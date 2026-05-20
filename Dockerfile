# Stage 1: Supabase deployer — runs migrations + edge functions on every deploy
FROM node:20-alpine AS deployer

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY supabase/ ./supabase/

CMD ["sh", "-c", "npx supabase link --project-ref $SUPABASE_PROJECT_ID && npx supabase db push --include-all --yes && npx supabase functions deploy"]

# Stage 2: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# Build arguments — public (baked into bundle)
ARG NEXT_PUBLIC_LIVE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Build arguments — server-side
ARG SUPABASE_PROJECT_ID
ARG SUPABASE_SERVICE_ROLE_KEY
ARG SUPABASE_ACCESS_TOKEN
ARG DEEPGRAM_API_KEY
ARG DEEPGRAM_PROJECT_ID
ARG DREAMIT_URL
ARG DREAMIT_FOLOUP_SECRET
ARG DREAMIT_SUPABASE_SERVICE_ROLE_KEY

# Set environment variables for build
ENV NEXT_PUBLIC_LIVE_URL=$NEXT_PUBLIC_LIVE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV SUPABASE_PROJECT_ID=$SUPABASE_PROJECT_ID
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN
ENV DEEPGRAM_API_KEY=$DEEPGRAM_API_KEY
ENV DEEPGRAM_PROJECT_ID=$DEEPGRAM_PROJECT_ID
ENV DREAMIT_URL=$DREAMIT_URL
ENV DREAMIT_FOLOUP_SECRET=$DREAMIT_FOLOUP_SECRET
ENV DREAMIT_SUPABASE_SERVICE_ROLE_KEY=$DREAMIT_SUPABASE_SERVICE_ROLE_KEY
ENV CI=true

# Validate required environment variables
RUN if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then \
      echo "ERROR: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set" && \
      exit 1; \
    fi

RUN npx update-browserslist-db@latest || true

RUN yarn build || (echo "Build failed. Check the error above." && exit 1)

# Stage 3: Production image
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

RUN apk add --no-cache curl

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
