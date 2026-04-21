/* =========================================
   impostorHandler.js — Jogo: O Impostor
   =========================================
   Handler server-side para o jogo do impostor.
   ========================================= */

const LOCATIONS = require('./locations');
const WORDS = require('./words');

const GAME_ID = 'impostor';

// Constantes de tempo
const VOTE_ENABLE_TIME = 5 * 60 * 1000; // 5 minutos em ms
const AUTO_VOTE_TIME = 10 * 60 * 1000;  // 10 minutos em ms
const VOTE_TIMEOUT = 60000; // 60 segundos para votarem quando a votação abrir

const autoVoteTimers = new Map();
const activeVoteTimers = new Map();

function init(io, roomManager) {
  io.on('connection', (socket) => {

    /* -----------------------------------------
       impostor:sync — Sincroniza estado inicial
       ----------------------------------------- */
    socket.on('impostor:sync', () => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) return;
        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room || room.state !== 'IN_GAME' || room.gameId !== GAME_ID) return;

        if (!room.gameState) {
          socket.emit('impostor:waitingForStart');
          return;
        }

        // Se o jogo está em andamento, emitir estado
        socket.emit('impostor:stateSynced', {
          phase: room.gameState.phase,
          gameStartTime: room.gameState.gameStartTime,
          impostorId: socket.id === room.gameState.impostorId ? room.gameState.impostorId : null,
          role: socket.id === room.gameState.impostorId ? 'IMPOSTOR' : 'INNOCENT',
          category: room.gameState.category,
          targetItem: socket.id === room.gameState.impostorId ? null : room.gameState.targetItem,
          allItems: room.gameState.category === 'words' ? WORDS : LOCATIONS,
          voteStartTime: room.gameState.voteStartTime,
          voteDeadline: room.gameState.voteDeadline,
          results: room.gameState.results
        });

      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       impostor:startGame — Inicia a partida e gera papéis
       ----------------------------------------- */
    socket.on('impostor:startGame', (payload) => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) return;

        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room) return;

        if (room.host !== socket.id) {
          socket.emit('room:error', { message: 'Apenas o anfitrião pode iniciar a partida.' });
          return;
        }

        const playerIds = Array.from(room.players.keys());
        if (playerIds.length < 2) {
          socket.emit('room:error', { message: 'É necessário pelo menos 2 jogadores.' });
          return;
        }

        // Sorteios
        const category = payload && payload.category === 'words' ? 'words' : 'locations';
        const itemsList = category === 'words' ? WORDS : LOCATIONS;
        
        const impostorId = playerIds[Math.floor(Math.random() * playerIds.length)];
        const targetItem = itemsList[Math.floor(Math.random() * itemsList.length)];
        const now = Date.now();

        room.gameState = {
          phase: 'IN_GAME',
          category,
          impostorId,
          targetItem,
          gameStartTime: now,
          votes: new Map(),
          voteStartTime: null,
          voteDeadline: null,
          results: null
        };
        room.lastActivity = now;

        clearTimers(roomInfo.code);

        // Agendar votação automática após 10 minutos
        const autoTimer = setTimeout(() => {
          forceOpenVoting(io, roomManager, roomInfo.code);
        }, AUTO_VOTE_TIME);
        autoVoteTimers.set(roomInfo.code, autoTimer);

        // Broadcast a todos
        room.players.forEach((p, pId) => {
          const isImpostor = pId === impostorId;
          io.to(pId).emit('impostor:gameStarted', {
            gameStartTime: now,
            role: isImpostor ? 'IMPOSTOR' : 'INNOCENT',
            category,
            targetItem: isImpostor ? null : targetItem,
            allItems: itemsList
          });
        });

        console.log(`[Impostor] Partida iniciada na sala ${roomInfo.code}. Impostor: ${room.players.get(impostorId).nickname}`);

      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       impostor:openVote — Inicia fase de votação
       ----------------------------------------- */
    socket.on('impostor:openVote', () => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) return;

        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room || room.state !== 'IN_GAME' || room.gameId !== GAME_ID) return;

        if (!room.gameState || room.gameState.phase !== 'IN_GAME') {
          socket.emit('room:error', { message: 'Não é possível abrir votação agora.' });
          return;
        }

        const isImpostor = socket.id === room.gameState.impostorId;
        const elapsed = Date.now() - room.gameState.gameStartTime;

        // Regra: Impostor só pode abrir após 5 minutos
        if (isImpostor && elapsed < VOTE_ENABLE_TIME) {
          socket.emit('room:error', { message: 'Você só pode abrir votação após 5 minutos.' });
          return;
        }

        forceOpenVoting(io, roomManager, roomInfo.code, socket.id);
      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       impostor:castVote — Registra o voto de um jogador
       Payload: { targetId: string }
       ----------------------------------------- */
    socket.on('impostor:castVote', (payload) => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) return;

        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room || !room.gameState || room.gameState.phase !== 'VOTING') {
          socket.emit('room:error', { message: 'Fora do período de votação.' });
          return;
        }

        const { targetId } = payload;
        if (!targetId || !room.players.has(targetId)) {
          socket.emit('room:error', { message: 'Jogador alvo inválido.' });
          return;
        }

        if (room.gameState.votes.has(socket.id)) {
          socket.emit('room:error', { message: 'Você já votou.' });
          return;
        }

        // Pode votar em si próprio? Depende. Em geral se proíbe ou se ignora, mas vamos permitir caso o cara der missclick
        
        room.gameState.votes.set(socket.id, targetId);
        room.lastActivity = Date.now();
        socket.emit('impostor:voteConfirmed');

        const totalPlayers = room.players.size;
        const totalVotes = room.gameState.votes.size;

        io.to(roomInfo.code).emit('impostor:voteProgress', { totalVotes, totalPlayers });

        // Todos votaram?
        if (totalVotes >= totalPlayers) {
          resolveVoting(io, roomManager, roomInfo.code);
        }

      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       impostor:end — Encerra jogo e volta ao LOBBY
       ----------------------------------------- */
    socket.on('impostor:end', () => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) return;

        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room || room.host !== socket.id) return;

        clearTimers(roomInfo.code);
        roomManager.finishGame(roomInfo.code);
        roomManager.returnToLobby(roomInfo.code);

        io.to(roomInfo.code).emit('impostor:ended');
        io.to(roomInfo.code).emit('room:updated', { room: roomManager.getRoom(roomInfo.code) });

      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });
  });
}

function forceOpenVoting(io, roomManager, roomCode, initiatorId = null) {
  const room = roomManager.getRoomRaw(roomCode);
  if (!room || !room.gameState || room.gameState.phase !== 'IN_GAME') return;

  clearTimers(roomCode);

  room.gameState.phase = 'VOTING';
  room.gameState.voteStartTime = Date.now();
  room.gameState.voteDeadline = room.gameState.voteStartTime + VOTE_TIMEOUT;
  room.lastActivity = Date.now();

  const initiatorNickname = initiatorId && room.players.get(initiatorId) ? room.players.get(initiatorId).nickname : 'O Sistema';

  io.to(roomCode).emit('impostor:votingOpened', {
    initiatorName: initiatorNickname,
    deadline: room.gameState.voteDeadline
  });

  const voteLimitTimer = setTimeout(() => {
    resolveVoting(io, roomManager, roomCode);
  }, VOTE_TIMEOUT);
  activeVoteTimers.set(roomCode, voteLimitTimer);

  console.log(`[Impostor] Votação iniciada na sala ${roomCode}`);
}

function resolveVoting(io, roomManager, roomCode) {
  const room = roomManager.getRoomRaw(roomCode);
  if (!room || !room.gameState || room.gameState.phase !== 'VOTING') return;

  clearActiveVoteTimer(roomCode);

  const votesCount = {};
  for (const [voterId, targetId] of room.gameState.votes) {
    votesCount[targetId] = (votesCount[targetId] || 0) + 1;
  }

  let maxVotes = 0;
  let mostVotedId = null;
  let isTie = false;

  for (const targetId in votesCount) {
    if (votesCount[targetId] > maxVotes) {
      maxVotes = votesCount[targetId];
      mostVotedId = targetId;
      isTie = false;
    } else if (votesCount[targetId] === maxVotes) {
      isTie = true;
    }
  }

  // Se ninguém votou ou houve empate pro mais votado, o impostor vence (inocentes não conseguiram concordar).
  // Se o mais votado for o impostor, Inocentes vencem.
  const impostorId = room.gameState.impostorId;
  let winners = 'IMPOSTOR'; 
  
  if (!isTie && mostVotedId === impostorId) {
    winners = 'INNOCENTS';
  }

  room.gameState.phase = 'RESULTS';
  room.gameState.results = {
    winners,
    impostorId,
    impostorNickname: room.players.get(impostorId) ? room.players.get(impostorId).nickname : 'Desconhecido',
    category: room.gameState.category,
    targetItem: room.gameState.targetItem,
    mostVotedId,
    mostVotedNickname: mostVotedId && room.players.get(mostVotedId) ? room.players.get(mostVotedId).nickname : null,
    isTie,
    votesCount
  };

  io.to(roomCode).emit('impostor:results', room.gameState.results);
  console.log(`[Impostor] Resultados na sala ${roomCode}: Vencedores -> ${winners}`);
}

function clearTimers(roomCode) {
  if (autoVoteTimers.has(roomCode)) {
    clearTimeout(autoVoteTimers.get(roomCode));
    autoVoteTimers.delete(roomCode);
  }
  clearActiveVoteTimer(roomCode);
}

function clearActiveVoteTimer(roomCode) {
  if (activeVoteTimers.has(roomCode)) {
    clearTimeout(activeVoteTimers.get(roomCode));
    activeVoteTimers.delete(roomCode);
  }
}

module.exports = { init, GAME_ID };
