FROM node:18-alpine

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy app sources
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
