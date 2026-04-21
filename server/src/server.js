/* =========================================
   server.js — Entry Point do Servidor
   =========================================
   Express + Socket.IO com registro modular
   de handlers para salas e jogos.
   ========================================= */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Módulos do projeto
const RoomManager = require('./rooms/RoomManager');
const roomHandler = require('./handlers/roomHandler');
const votacaoHandler = require('./games/votacao/votacaoHandler');
const impostorHandler = require('./games/impostor/impostorHandler');

/* -----------------------------------------
   CONFIGURAÇÃO
   ----------------------------------------- */
const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || `http://localhost:${PORT}`;

/* -----------------------------------------
   EXPRESS
   ----------------------------------------- */
const app = express();

// Servir arquivos estáticos da raiz do projeto (um nível acima de /server)
const staticRoot = path.join(__dirname, '..', '..');
app.use(express.static(staticRoot));

// Rota de health check (útil para deploy)
app.get('/api/health', (req, res) => {
  const stats = roomManager.getStats();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    ...stats,
  });
});

/* -----------------------------------------
   SERVIDOR HTTP + SOCKET.IO
   ----------------------------------------- */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
  // Configurações de performance
  pingTimeout: 60000,
  pingInterval: 25000,
});

/* -----------------------------------------
   ROOM MANAGER (Instância Única)
   ----------------------------------------- */
const roomManager = new RoomManager();

/* -----------------------------------------
   REGISTRAR HANDLERS
   ----------------------------------------- */

// 1. Handler genérico de salas (room:create, room:join, etc.)
roomHandler(io, roomManager);

// 2. Handler do jogo de Votação Anônima
votacaoHandler.init(io, roomManager);

// 3. Handler do jogo O Impostor
impostorHandler.init(io, roomManager);

// ═══════════════════════════════════════════
// Para adicionar novos jogos, basta:
//   const novoJogo = require('./games/nome-do-jogo/handler');
//   novoJogo.init(io, roomManager);
// ═══════════════════════════════════════════

/* -----------------------------------------
   LIMPEZA PERIÓDICA DE SALAS INATIVAS
   ----------------------------------------- */
roomManager.startCleanup(60000); // A cada 1 minuto

/* -----------------------------------------
   INICIAR SERVIDOR
   ----------------------------------------- */
server.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║      🎮 PartyGames Server Online 🎮       ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log(`║  URL:  http://localhost:${PORT}              ║`);
  console.log(`║  Env:  ${process.env.NODE_ENV || 'development'}                        ║`);
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
});

/* -----------------------------------------
   GRACEFUL SHUTDOWN
   ----------------------------------------- */
process.on('SIGTERM', () => {
  console.log('\n[Server] SIGTERM recebido — encerrando...');
  roomManager.stopCleanup();
  io.close();
  server.close(() => {
    console.log('[Server] Encerrado com sucesso.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[Server] SIGINT recebido — encerrando...');
  roomManager.stopCleanup();
  io.close();
  server.close(() => {
    console.log('[Server] Encerrado com sucesso.');
    process.exit(0);
  });
});
