FROM node:16.13.0

RUN apt-get update && \
  apt-get install -y \
  neofetch \
  ffmpeg \
  wget \
  chromium \ 
  imagemagick && \
  rm -rf /var/lib/apt/lists/*

COPY package.json .
RUN npm install -g npm@latest 
RUN npm install -g pm2
ENV PM2_PUBLIC_KEY c60uotphka2yots
ENV PM2_SECRET_KEY nfquxne9m9rvl7p
RUN npm install 

COPY . .
EXPOSE 5000

CMD ["pm2-runtime", "index.js"]
