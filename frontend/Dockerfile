FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm ci --silent
COPY . .
CMD ["npm", "run", "dev"]
FROM nginx:alpine

COPY index.html /usr/share/nginx/html/index.html
