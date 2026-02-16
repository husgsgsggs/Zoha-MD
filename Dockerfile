FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p session assets
CMD ["npm", "start"]
