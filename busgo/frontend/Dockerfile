# Build stage
FROM node:20-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Set build-time env vars
ARG VITE_API_BASE_URL
ARG VITE_BASE_PATH=/
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
# Run build - bypass tsc if it's causing issues, or ensure it works
RUN npm run build

# Production stage
FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
# Custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
