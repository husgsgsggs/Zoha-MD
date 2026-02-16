FROM node:18

# Install system dependencies for image and media handling
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (better for caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the project
COPY . .

# Ensure necessary folders exist
RUN mkdir -p session assets

# The bot starts here
CMD ["npm", "start"]
