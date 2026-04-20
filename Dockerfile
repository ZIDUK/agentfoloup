# Stage 1: Build the application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for Vite environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Build arguments for Supabase CLI
ARG SUPABASE_PROJECT_ID
ARG SUPABASE_ACCESS_TOKEN
ARG SUPABASE_DB_PASSWORD

# Set environment variables for build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV SUPABASE_PROJECT_ID=$SUPABASE_PROJECT_ID
ENV SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN
ENV SUPABASE_DB_PASSWORD=$SUPABASE_DB_PASSWORD
ENV CI=true

# Validate required environment variables
RUN if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then \
      echo "ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set" && \
      exit 1; \
    fi

# Update browserslist database to avoid warnings
RUN npx update-browserslist-db@latest || true

# Build the application with verbose output
RUN npm run build || (echo "Build failed. Check the error above." && exit 1)

# Install Supabase CLI
RUN apk add --no-cache curl
RUN curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
  | tar -xz -C /usr/local/bin

# Link to Supabase project and deploy migrations + functions (NON-INTERACTIVE)
RUN supabase link --project-ref $SUPABASE_PROJECT_ID
RUN npm run supabase:deploy

# Stage 2: Production image with nginx
FROM nginx:alpine AS production

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Install curl for healthcheck
RUN apk add --no-cache curl

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
