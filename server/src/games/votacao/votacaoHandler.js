/* =========================================
   votacaoHandler.js — Jogo: Votação Anônima
   =========================================
   Handler server-side para o jogo de votação.
   O HOST cria perguntas com opções, jogadores
   votam anonimamente, e resultados são revelados.

   Máquina de estados:
   WAITING_QUESTION → VOTING → RESULTS → WAITING_QUESTION (loop)
   ========================================= */

/** @type {string} Identificador único deste jogo */
const GAME_ID = 'votacao';

/**
 * @typedef {Object} VotacaoState
 * @property {'WAITING_QUESTION'|'VOTING'|'RESULTS'} phase - Fase atual do jogo
 * @property {number} round - Número da rodada atual
 * @property {string|null} question - Pergunta da rodada
 * @property {string[]} options - Opções de voto
 * @property {Map<string, number>} votes - socketId → índice da opção votada
 * @property {number|null} voteDeadline - Timestamp do deadline de votação
 * @property {Object|null} results - Resultados calculados
 */

/** @type {Map<string, NodeJS.Timeout>} roomCode → timer de votação */
const voteTimers = new Map();

/** Tempo máximo para votação (ms) */
const VOTE_TIMEOUT = 60000; // 60 segundos

/**
 * Inicializa os handlers do jogo de Votação Anônima.
 * Este é o padrão que todos os jogos multi-device devem seguir:
 * exportar uma função init(io, roomManager) que registra eventos.
 *
 * @param {import('socket.io').Server} io - Instância do Socket.IO Server
 * @param {import('../../rooms/RoomManager')} roomManager - Instância do RoomManager
 */
function init(io, roomManager) {
  io.on('connection', (socket) => {

    /* -----------------------------------------
       votacao:createPoll — HOST cria uma pergunta
       Payload: { question: string, options: string[] }
       ----------------------------------------- */
    socket.on('votacao:createPoll', (payload) => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) {
          socket.emit('room:error', { message: 'Você não está em nenhuma sala.' });
          return;
        }

        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room) return;

        // Verificar se é HOST
        if (room.host !== socket.id) {
          socket.emit('room:error', { message: 'Apenas o HOST pode criar perguntas.' });
          return;
        }

        // Verificar se o jogo está ativo e é votação
        if (room.state !== 'IN_GAME' || room.gameId !== GAME_ID) {
          socket.emit('room:error', { message: 'O jogo de votação não está ativo.' });
          return;
        }

        // Validar payload
        if (!payload || typeof payload !== 'object') {
          socket.emit('room:error', { message: 'Dados inválidos.' });
          return;
        }

        const { question, options } = payload;

        if (typeof question !== 'string' || question.trim().length === 0) {
          socket.emit('room:error', { message: 'A pergunta é obrigatória.' });
          return;
        }

        if (question.trim().length > 200) {
          socket.emit('room:error', { message: 'A pergunta deve ter no máximo 200 caracteres.' });
          return;
        }

        if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
          socket.emit('room:error', { message: 'Forneça entre 2 e 6 opções.' });
          return;
        }

        // Sanitizar opções
        const sanitizedOptions = options.map((opt) => {
          if (typeof opt !== 'string') return '';
          return opt.replace(/[<>\"'&]/g, '').trim().substring(0, 100);
        });

        // Verificar se tem opções vazias
        if (sanitizedOptions.some((opt) => opt.length === 0)) {
          socket.emit('room:error', { message: 'Todas as opções devem ter conteúdo.' });
          return;
        }

        // Verificar fase (deve estar em WAITING_QUESTION)
        if (room.gameState && room.gameState.phase !== 'WAITING_QUESTION') {
          socket.emit('room:error', { message: 'Aguarde a rodada atual terminar.' });
          return;
        }

        // Criar estado da rodada
        const round = room.gameState ? room.gameState.round + 1 : 1;
        const deadline = Date.now() + VOTE_TIMEOUT;

        room.gameState = {
          phase: 'VOTING',
          round,
          question: question.replace(/[<>\"'&]/g, '').trim().substring(0, 200),
          options: sanitizedOptions,
          votes: new Map(),
          voteDeadline: deadline,
          results: null,
        };

        room.lastActivity = Date.now();

        // Emitir pergunta para todos
        io.to(roomInfo.code).emit('votacao:pollCreated', {
          round,
          question: room.gameState.question,
          options: sanitizedOptions,
          deadline,
          totalPlayers: room.players.size,
        });

        // Timer para encerrar votação automaticamente
        clearVoteTimer(roomInfo.code);
        const timer = setTimeout(() => {
          resolveVoting(io, roomManager, roomInfo.code);
        }, VOTE_TIMEOUT);
        voteTimers.set(roomInfo.code, timer);

        console.log(`[Votação] Rodada ${round} criada na sala ${roomInfo.code}: "${room.gameState.question}"`);
      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       votacao:vote — Jogador vota em uma opção
       Payload: { optionIndex: number }
       ----------------------------------------- */
    socket.on('votacao:vote', (payload) => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) {
          socket.emit('room:error', { message: 'Você não está em nenhuma sala.' });
          return;
        }

        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room || room.state !== 'IN_GAME' || room.gameId !== GAME_ID) {
          socket.emit('room:error', { message: 'O jogo de votação não está ativo.' });
          return;
        }

        if (!room.gameState || room.gameState.phase !== 'VOTING') {
          socket.emit('room:error', { message: 'A votação não está aberta.' });
          return;
        }

        // Validar payload
        if (!payload || typeof payload !== 'object') {
          socket.emit('room:error', { message: 'Dados inválidos.' });
          return;
        }

        const { optionIndex } = payload;

        if (typeof optionIndex !== 'number' || !Number.isInteger(optionIndex)) {
          socket.emit('room:error', { message: 'Índice de opção inválido.' });
          return;
        }

        if (optionIndex < 0 || optionIndex >= room.gameState.options.length) {
          socket.emit('room:error', { message: 'Opção não existe.' });
          return;
        }

        // Verificar se já votou
        if (room.gameState.votes.has(socket.id)) {
          socket.emit('room:error', { message: 'Você já votou nesta rodada.' });
          return;
        }

        // Registrar voto
        room.gameState.votes.set(socket.id, optionIndex);
        room.lastActivity = Date.now();

        // Confirmar voto ao jogador
        socket.emit('votacao:voteConfirmed', { optionIndex });

        // Notificar todos sobre progresso (sem revelar votos)
        const totalPlayers = room.players.size;
        const totalVotes = room.gameState.votes.size;

        io.to(roomInfo.code).emit('votacao:voteProgress', {
          totalVotes,
          totalPlayers,
        });

        console.log(`[Votação] Voto recebido na sala ${roomInfo.code} (${totalVotes}/${totalPlayers})`);

        // Se todos votaram, resolver imediatamente
        if (totalVotes >= totalPlayers) {
          clearVoteTimer(roomInfo.code);
          resolveVoting(io, roomManager, roomInfo.code);
        }
      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       votacao:nextRound — HOST inicia nova rodada
       ----------------------------------------- */
    socket.on('votacao:nextRound', () => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) return;

        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room || room.host !== socket.id) {
          socket.emit('room:error', { message: 'Apenas o HOST pode avançar a rodada.' });
          return;
        }

        if (!room.gameState || room.gameState.phase !== 'RESULTS') {
          socket.emit('room:error', { message: 'Aguarde os resultados para avançar.' });
          return;
        }

        // Preparar para nova rodada
        room.gameState = {
          phase: 'WAITING_QUESTION',
          round: room.gameState.round,
          question: null,
          options: [],
          votes: new Map(),
          voteDeadline: null,
          results: null,
        };

        room.lastActivity = Date.now();

        io.to(roomInfo.code).emit('votacao:nextRound', {
          round: room.gameState.round + 1,
        });

        console.log(`[Votação] Próxima rodada na sala ${roomInfo.code}`);
      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       votacao:end — HOST encerra o jogo
       ----------------------------------------- */
    socket.on('votacao:end', () => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) return;

        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room || room.host !== socket.id) {
          socket.emit('room:error', { message: 'Apenas o HOST pode encerrar o jogo.' });
          return;
        }

        clearVoteTimer(roomInfo.code);
        roomManager.finishGame(roomInfo.code);
        roomManager.returnToLobby(roomInfo.code);

        const updatedRoom = roomManager.getRoom(roomInfo.code);

        io.to(roomInfo.code).emit('votacao:ended');
        io.to(roomInfo.code).emit('room:updated', { room: updatedRoom });

        console.log(`[Votação] Jogo encerrado na sala ${roomInfo.code}`);
      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });
  });
}

/**
 * Resolve a votação: calcula e distribui resultados.
 * Chamada quando todos votaram ou o timeout expirou.
 * @param {import('socket.io').Server} io
 * @param {import('../../rooms/RoomManager')} roomManager
 * @param {string} roomCode
 */
function resolveVoting(io, roomManager, roomCode) {
  const room = roomManager.getRoomRaw(roomCode);
  if (!room || !room.gameState || room.gameState.phase !== 'VOTING') return;

  const { options, votes } = room.gameState;

  // Calcular votos por opção
  const voteCounts = new Array(options.length).fill(0);
  for (const [, optionIndex] of votes) {
    voteCounts[optionIndex]++;
  }

  // Calcular porcentagens
  const totalVotes = votes.size;
  const results = options.map((option, index) => ({
    option,
    votes: voteCounts[index],
    percentage: totalVotes > 0 ? Math.round((voteCounts[index] / totalVotes) * 100) : 0,
  }));

  // Ordenar por votos (maior primeiro)
  results.sort((a, b) => b.votes - a.votes);

  room.gameState.phase = 'RESULTS';
  room.gameState.results = results;
  room.lastActivity = Date.now();

  // Emitir resultados para todos
  io.to(roomCode).emit('votacao:results', {
    round: room.gameState.round,
    question: room.gameState.question,
    results,
    totalVotes,
    totalPlayers: room.players.size,
  });

  console.log(`[Votação] Resultados da rodada ${room.gameState.round} na sala ${roomCode}`);
}

/**
 * Limpa o timer de votação de uma sala.
 * @param {string} roomCode
 */
function clearVoteTimer(roomCode) {
  const timer = voteTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    voteTimers.delete(roomCode);
  }
}

module.exports = { init, GAME_ID };
