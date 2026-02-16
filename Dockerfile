FROM node:18

RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expose the port for Sevalla
EXPOSE 3000

RUN mkdir -p session assets

CMD ["npm", "start"]
