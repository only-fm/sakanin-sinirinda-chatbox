FROM node:22-alpine AS frontend-base
WORKDIR /workspace
ARG VITE_LANDING_APP_URL=http://localhost:8080
ARG VITE_LOGIN_APP_URL=http://localhost:8080
ARG VITE_STUDENT_APP_URL=http://localhost:8081
ARG VITE_TEACHER_APP_URL=http://localhost:8082
ARG VITE_ADMIN_APP_URL=http://localhost:8083
ARG VITE_API_BASE_URL=/api
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_LANDING_APP_URL=$VITE_LANDING_APP_URL
ENV VITE_LOGIN_APP_URL=$VITE_LOGIN_APP_URL
ENV VITE_STUDENT_APP_URL=$VITE_STUDENT_APP_URL
ENV VITE_TEACHER_APP_URL=$VITE_TEACHER_APP_URL
ENV VITE_ADMIN_APP_URL=$VITE_ADMIN_APP_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/landing-web/package.json ./apps/landing-web/package.json
COPY apps/student-web/package.json ./apps/student-web/package.json
COPY apps/teacher-web/package.json ./apps/teacher-web/package.json
COPY apps/admin-web/package.json ./apps/admin-web/package.json
RUN npm ci

FROM frontend-base AS landing-development
COPY apps/landing-web ./apps/landing-web
EXPOSE 5172
CMD ["npm", "run", "dev", "--workspace", "apps/landing-web", "--", "--host", "0.0.0.0"]

FROM frontend-base AS student-development
COPY apps/student-web ./apps/student-web
COPY apps/shared ./apps/shared
EXPOSE 5170 5173
CMD ["npm", "run", "dev", "--workspace", "apps/student-web", "--", "--host", "0.0.0.0"]

FROM frontend-base AS teacher-development
COPY apps/teacher-web ./apps/teacher-web
COPY apps/shared ./apps/shared
EXPOSE 5174
CMD ["npm", "run", "dev", "--workspace", "apps/teacher-web", "--", "--host", "0.0.0.0"]

FROM frontend-base AS admin-development
COPY apps/admin-web ./apps/admin-web
COPY apps/shared ./apps/shared
EXPOSE 5175
CMD ["npm", "run", "dev", "--workspace", "apps/admin-web", "--", "--host", "0.0.0.0"]

FROM frontend-base AS landing-build
COPY apps/landing-web ./apps/landing-web
RUN npm run build --workspace apps/landing-web

FROM frontend-base AS student-build
COPY apps/student-web ./apps/student-web
COPY apps/shared ./apps/shared
RUN npm run build --workspace apps/student-web

FROM frontend-base AS teacher-build
COPY apps/teacher-web ./apps/teacher-web
COPY apps/shared ./apps/shared
RUN npm run build --workspace apps/teacher-web

FROM frontend-base AS admin-build
COPY apps/admin-web ./apps/admin-web
COPY apps/shared ./apps/shared
RUN npm run build --workspace apps/admin-web

FROM nginx:1.27-alpine AS frontend-production
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf

FROM frontend-production AS landing-production
COPY --from=landing-build /workspace/apps/landing-web/dist /usr/share/nginx/html

FROM frontend-production AS student-production
COPY --from=student-build /workspace/apps/student-web/dist /usr/share/nginx/html

FROM frontend-production AS teacher-production
COPY --from=teacher-build /workspace/apps/teacher-web/dist /usr/share/nginx/html

FROM frontend-production AS admin-production
COPY --from=admin-build /workspace/apps/admin-web/dist /usr/share/nginx/html
