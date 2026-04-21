/* =========================================
   confissoesHandler.js — Jogo: Confissões
   =========================================
   Handler server-side para o jogo Confissões.
   A cada rodada, um mestre recebe uma palavra e
   um valor Verdade/Mentira. Os demais jogadores
   votam se a história é verdade ou mentira.
   ========================================= */

const WORDS = require('./words');

const GAME_ID = 'confissoes';

function init(io, roomManager) {
  io.on('connection', (socket) => {

    /* -----------------------------------------
       confissoes:sync — Sincroniza estado inicial
       ----------------------------------------- */
    socket.on('confissoes:sync', () => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) return;
        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room || room.state !== 'IN_GAME' || room.gameId !== GAME_ID) return;

        if (!room.gameState) {
          socket.emit('confissoes:waitingForStart');
          return;
        }

        const gs = room.gameState;
        const isMaster = socket.id === gs.masterOrder[gs.masterIndex];

        if (gs.phase === 'STORYTELLING') {
          socket.emit('confissoes:roundStarted', {
            phase: gs.phase,
            word: gs.currentWord,
            isMaster,
            truthValue: isMaster ? gs.truthValue : undefined,
            masterNickname: getMasterNickname(room),
            roundNumber: gs.masterIndex + 1,
            totalRounds: gs.masterOrder.length,
          });
        } else if (gs.phase === 'RESULTS') {
          socket.emit('confissoes:roundResults', gs.results);
        }
      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       confissoes:startRound — Inicia uma rodada
       ----------------------------------------- */
    socket.on('confissoes:startRound', () => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) return;

        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room) return;

        if (room.host !== socket.id) {
          socket.emit('room:error', { message: 'Apenas o anfitrião pode iniciar a rodada.' });
          return;
        }

        const playerIds = Array.from(room.players.keys());
        if (playerIds.length < 3) {
          socket.emit('room:error', { message: 'É necessário pelo menos 3 jogadores.' });
          return;
        }

        // Se não há gameState ainda, criar a ordem dos mestres
        if (!room.gameState || room.gameState.phase === 'RESULTS') {
          const prevIndex = room.gameState ? room.gameState.masterIndex : -1;
          const prevOrder = room.gameState ? room.gameState.masterOrder : null;

          // Construir nova ordem se é a primeira rodada
          let masterOrder;
          let masterIndex;

          if (prevOrder) {
            // Manter a ordem existente e avançar o índice
            // Atualizar a lista para refletir jogadores atuais (caso alguém tenha saído)
            masterOrder = prevOrder.filter(id => room.players.has(id));
            // Adicionar novos jogadores que não estavam na ordem
            playerIds.forEach(id => {
              if (!masterOrder.includes(id)) masterOrder.push(id);
            });
            masterIndex = (prevIndex + 1) % masterOrder.length;
          } else {
            // Primeira rodada: embaralhar
            masterOrder = shuffleArray([...playerIds]);
            masterIndex = 0;
          }

          const currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
          const truthValue = Math.random() < 0.5;
          const now = Date.now();

          room.gameState = {
            phase: 'STORYTELLING',
            masterIndex,
            masterOrder,
            currentWord,
            truthValue,
            votes: new Map(),
            results: null,
          };
          room.lastActivity = now;

        }

        const gs = room.gameState;
        const masterId = gs.masterOrder[gs.masterIndex];
        const masterPlayer = room.players.get(masterId);
        const masterNickname = masterPlayer ? masterPlayer.nickname : 'Desconhecido';

        // Broadcast a todos
        room.players.forEach((p, pId) => {
          const isMaster = pId === masterId;
          io.to(pId).emit('confissoes:roundStarted', {
            phase: 'STORYTELLING',
            word: gs.currentWord,
            isMaster,
            truthValue: isMaster ? gs.truthValue : undefined,
            masterNickname,
            roundNumber: gs.masterIndex + 1,
            totalRounds: gs.masterOrder.length,
          });
        });

        console.log(`[Confissões] Rodada ${gs.masterIndex + 1} iniciada na sala ${roomInfo.code}. Mestre: ${masterNickname}. Palavra: ${gs.currentWord}. Verdade: ${gs.truthValue}`);

      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       confissoes:vote — Jogador vota
       Payload: { vote: boolean } (true = verdade)
       ----------------------------------------- */
    socket.on('confissoes:vote', (payload) => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) return;

        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room || !room.gameState || room.gameState.phase !== 'STORYTELLING') {
          socket.emit('room:error', { message: 'Fora do período de votação.' });
          return;
        }

        const gs = room.gameState;
        const masterId = gs.masterOrder[gs.masterIndex];

        // O mestre não pode votar
        if (socket.id === masterId) {
          socket.emit('room:error', { message: 'O mestre não pode votar.' });
          return;
        }

        // Já votou?
        if (gs.votes.has(socket.id)) {
          socket.emit('room:error', { message: 'Você já votou.' });
          return;
        }

        const vote = !!payload.vote; // true = acredita que é verdade
        gs.votes.set(socket.id, vote);
        room.lastActivity = Date.now();

        socket.emit('confissoes:voteConfirmed');

        // Total de jogadores que podem votar = todos - mestre
        const eligibleVoters = room.players.size - 1;
        // A rodada encerra quando N-2 votarem (excluindo o mestre = N-1 possíveis,
        // e queremos que o último desses N-1 não consiga votar = encerra com N-2 votos)
        const votesNeeded = eligibleVoters - 1; // N - 2
        const totalVotes = gs.votes.size;

        if (totalVotes >= votesNeeded) {
          resolveRound(io, roomManager, roomInfo.code);
        }

      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       confissoes:nextRound — Avança para próxima rodada
       ----------------------------------------- */
    socket.on('confissoes:nextRound', () => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) return;

        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room || room.host !== socket.id) return;

        if (!room.gameState || room.gameState.phase !== 'RESULTS') {
          socket.emit('room:error', { message: 'Não é possível avançar agora.' });
          return;
        }

        // Preparar próxima rodada
        const gs = room.gameState;
        const playerIds = Array.from(room.players.keys());

        // Atualizar masterOrder (se alguém saiu/entrou)
        let masterOrder = gs.masterOrder.filter(id => room.players.has(id));
        playerIds.forEach(id => {
          if (!masterOrder.includes(id)) masterOrder.push(id);
        });

        const masterIndex = (gs.masterIndex + 1) % masterOrder.length;

        const currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
        const truthValue = Math.random() < 0.5;

        room.gameState = {
          phase: 'STORYTELLING',
          masterIndex,
          masterOrder,
          currentWord,
          truthValue,
          votes: new Map(),
          results: null,
        };
        room.lastActivity = Date.now();

        const masterId = masterOrder[masterIndex];
        const masterPlayer = room.players.get(masterId);
        const masterNickname = masterPlayer ? masterPlayer.nickname : 'Desconhecido';

        room.players.forEach((p, pId) => {
          const isMaster = pId === masterId;
          io.to(pId).emit('confissoes:roundStarted', {
            phase: 'STORYTELLING',
            word: currentWord,
            isMaster,
            truthValue: isMaster ? truthValue : undefined,
            masterNickname,
            roundNumber: masterIndex + 1,
            totalRounds: masterOrder.length,
          });
        });

        console.log(`[Confissões] Rodada ${masterIndex + 1} na sala ${roomInfo.code}. Mestre: ${masterNickname}`);

      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       confissoes:end — Encerra jogo e volta ao lobby
       ----------------------------------------- */
    socket.on('confissoes:end', () => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) return;

        const room = roomManager.getRoomRaw(roomInfo.code);
        if (!room || room.host !== socket.id) return;

        roomManager.finishGame(roomInfo.code);
        roomManager.returnToLobby(roomInfo.code);

        io.to(roomInfo.code).emit('confissoes:ended');
        io.to(roomInfo.code).emit('room:updated', { room: roomManager.getRoom(roomInfo.code) });

      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });
  });
}

/* -----------------------------------------
   resolveRound — Calcula os resultados da rodada
   ----------------------------------------- */
function resolveRound(io, roomManager, roomCode) {
  const room = roomManager.getRoomRaw(roomCode);
  if (!room || !room.gameState || room.gameState.phase !== 'STORYTELLING') return;

  const gs = room.gameState;
  const masterId = gs.masterOrder[gs.masterIndex];
  const masterPlayer = room.players.get(masterId);
  const masterNickname = masterPlayer ? masterPlayer.nickname : 'Desconhecido';

  const winners = [];
  const losers = [];

  // Identificar quem não votou (último jogador)
  const nonVoters = [];
  room.players.forEach((p, pId) => {
    if (pId === masterId) return; // Mestre não participa
    if (!gs.votes.has(pId)) {
      nonVoters.push({ id: pId, nickname: p.nickname });
    }
  });

  // O(s) último(s) a NÃO votar perdem
  nonVoters.forEach(nv => {
    losers.push({ id: nv.id, nickname: nv.nickname, reason: 'Último a votar' });
  });

  // Para quem votou, verificar se acertou
  gs.votes.forEach((vote, pId) => {
    const player = room.players.get(pId);
    if (!player) return;
    const correct = vote === gs.truthValue;
    if (correct) {
      winners.push({ id: pId, nickname: player.nickname });
    } else {
      losers.push({ id: pId, nickname: player.nickname, reason: 'Palpite errado' });
    }
  });

  gs.phase = 'RESULTS';
  gs.results = {
    masterNickname,
    masterId,
    word: gs.currentWord,
    truthValue: gs.truthValue,
    winners,
    losers,
    roundNumber: gs.masterIndex + 1,
    totalRounds: gs.masterOrder.length,
  };

  io.to(roomCode).emit('confissoes:roundResults', gs.results);
  console.log(`[Confissões] Resultados da rodada na sala ${roomCode}. Vencedores: ${winners.length}, Perdedores: ${losers.length}`);
}

/* -----------------------------------------
   Utilitários
   ----------------------------------------- */
function getMasterNickname(room) {
  const gs = room.gameState;
  if (!gs) return 'Desconhecido';
  const masterId = gs.masterOrder[gs.masterIndex];
  const masterPlayer = room.players.get(masterId);
  return masterPlayer ? masterPlayer.nickname : 'Desconhecido';
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

module.exports = { init, GAME_ID };
