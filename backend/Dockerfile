FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 4000

CMD ["sh", "-c", "until node -e \"const net=require('net');const s=net.connect(5432,'db',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));\"; do echo 'Waiting for db:5432...'; sleep 2; done; npx prisma db push && (npm run seed || true) && npm start"]
