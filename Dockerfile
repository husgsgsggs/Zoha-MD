FROM node:18

# System tools for media processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Universal downloader
RUN pip3 install yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm i --legacy-peer-deps

COPY . .

RUN mkdir -p session assets

EXPOSE 3000

CMD ["npm", "start"]
