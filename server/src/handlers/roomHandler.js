/* =========================================
   roomHandler.js — Eventos Socket.IO de Sala
   =========================================
   Registra os listeners de eventos genéricos
   do sistema de salas (independente de jogo).
   ========================================= */

/**
 * Registra os handlers de eventos de sala no Socket.IO.
 * @param {import('socket.io').Server} io - Instância do Socket.IO Server
 * @param {import('../rooms/RoomManager')} roomManager - Instância do RoomManager
 */
function roomHandler(io, roomManager) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Conexão: ${socket.id}`);

    /* -----------------------------------------
       room:create — Criar nova sala
       Payload: { nickname: string }
       ----------------------------------------- */
    socket.on('room:create', (payload) => {
      try {
        // Validação de payload
        if (!payload || typeof payload !== 'object') {
          socket.emit('room:error', { message: 'Dados inválidos.' });
          return;
        }

        const { nickname } = payload;

        if (typeof nickname !== 'string' || nickname.trim().length === 0) {
          socket.emit('room:error', { message: 'Nickname é obrigatório.' });
          return;
        }

        if (nickname.trim().length > 20) {
          socket.emit('room:error', { message: 'Nickname deve ter no máximo 20 caracteres.' });
          return;
        }

        const result = roomManager.createRoom(socket.id, nickname.trim());

        // Entrar na room do Socket.IO (para broadcasts)
        socket.join(result.code);

        // Responder ao criador
        socket.emit('room:created', {
          code: result.code,
          room: result.room,
        });

        console.log(`[Socket] room:create — Sala ${result.code} criada por "${nickname.trim()}"`);
      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       room:join — Entrar em sala existente
       Payload: { code: string, nickname: string }
       ----------------------------------------- */
    socket.on('room:join', (payload) => {
      try {
        if (!payload || typeof payload !== 'object') {
          socket.emit('room:error', { message: 'Dados inválidos.' });
          return;
        }

        const { code, nickname } = payload;

        if (typeof code !== 'string' || code.trim().length !== 4) {
          socket.emit('room:error', { message: 'Código de sala deve ter 4 letras.' });
          return;
        }

        if (typeof nickname !== 'string' || nickname.trim().length === 0) {
          socket.emit('room:error', { message: 'Nickname é obrigatório.' });
          return;
        }

        if (nickname.trim().length > 20) {
          socket.emit('room:error', { message: 'Nickname deve ter no máximo 20 caracteres.' });
          return;
        }

        const result = roomManager.joinRoom(code.trim(), socket.id, nickname.trim());

        // Entrar na room do Socket.IO
        socket.join(code.trim().toUpperCase());

        // Responder ao jogador que entrou
        socket.emit('room:joined', { room: result.room });

        // Notificar todos na sala (incluindo o novo jogador)
        io.to(code.trim().toUpperCase()).emit('room:updated', { room: result.room });

        console.log(`[Socket] room:join — "${nickname.trim()}" entrou na sala ${code.trim().toUpperCase()}`);
      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       room:rejoin — Reconectar (após navegação)
       Payload: { code: string, nickname: string }
       ----------------------------------------- */
    socket.on('room:rejoin', (payload) => {
      try {
        if (!payload || typeof payload !== 'object') {
          socket.emit('room:error', { message: 'Dados inválidos.' });
          return;
        }

        const { code, nickname } = payload;

        if (!code || !nickname) {
          socket.emit('room:error', { message: 'Código de sala e nickname são obrigatórios para reconectar.' });
          return;
        }

        const result = roomManager.rejoinRoom(code.trim(), socket.id, nickname.trim());

        // Entrar na room do Socket.IO
        socket.join(code.trim().toUpperCase());

        // Responder ao jogador que entrou
        socket.emit('room:rejoined', { room: result.room, isHost: result.isHost });

        // Notificar todos na sala
        io.to(code.trim().toUpperCase()).emit('room:updated', { room: result.room });

        console.log(`[Socket] room:rejoin — "${nickname.trim()}" reconectou na sala ${code.trim().toUpperCase()}`);
      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       room:leave — Sair da sala atual
       ----------------------------------------- */
    socket.on('room:leave', () => {
      handlePlayerLeave(io, socket, roomManager);
    });

    /* -----------------------------------------
       room:start — Iniciar o jogo (apenas HOST)
       ----------------------------------------- */
    socket.on('room:start', () => {
      try {
        const roomInfo = roomManager.getRoomBySocket(socket.id);

        if (!roomInfo) {
          socket.emit('room:error', { message: 'Você não está em nenhuma sala.' });
          return;
        }

        const roomRaw = roomManager.getRoomRaw(roomInfo.code);

        if (!roomRaw.gameId) {
          socket.emit('room:error', { message: 'Selecione um jogo antes de iniciar.' });
          return;
        }

        const result = roomManager.startGame(roomInfo.code, socket.id);

        // Notificar todos na sala que o jogo começou
        io.to(roomInfo.code).emit('room:started', {
          room: result.room,
          gameId: roomRaw.gameId,
        });

        console.log(`[Socket] room:start — Jogo iniciado na sala ${roomInfo.code}`);
      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       room:selectGame — Selecionar jogo (HOST)
       Payload: { gameId: string }
       ----------------------------------------- */
    socket.on('room:selectGame', (payload) => {
      try {
        if (!payload || typeof payload !== 'object') {
          socket.emit('room:error', { message: 'Dados inválidos.' });
          return;
        }

        const { gameId } = payload;

        if (typeof gameId !== 'string' || gameId.trim().length === 0) {
          socket.emit('room:error', { message: 'ID do jogo inválido.' });
          return;
        }

        const roomInfo = roomManager.getRoomBySocket(socket.id);
        if (!roomInfo) {
          socket.emit('room:error', { message: 'Você não está em nenhuma sala.' });
          return;
        }

        const result = roomManager.selectGame(roomInfo.code, socket.id, gameId.trim());

        // Notificar todos
        io.to(roomInfo.code).emit('room:updated', { room: result.room });

        console.log(`[Socket] room:selectGame — Jogo "${gameId.trim()}" selecionado na sala ${roomInfo.code}`);
      } catch (error) {
        socket.emit('room:error', { message: error.message });
      }
    });

    /* -----------------------------------------
       disconnect — Jogador desconectou
       ----------------------------------------- */
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Desconexão: ${socket.id} (motivo: ${reason})`);

      const roomInfo = roomManager.getRoomBySocket(socket.id);
      if (!roomInfo) return;

      // Agendar remoção com grace period
      roomManager.scheduleDisconnect(socket.id, (disconnectedSocketId, roomCode) => {
        // Este callback é chamado quando o grace period expira
        const result = roomManager.leaveRoom(disconnectedSocketId);

        if (result.dissolved) {
          // Sala foi dissolvida (último jogador saiu)
          io.to(roomCode).emit('room:dissolved');
          console.log(`[Socket] Sala ${roomCode} dissolvida após timeout de desconexão`);
        } else if (result.room) {
          // Notificar jogadores restantes
          if (result.newHost) {
            io.to(roomCode).emit('room:hostChanged', {
              newHostId: result.newHost.id,
              newHostNickname: result.newHost.nickname,
            });
          }
          io.to(roomCode).emit('room:updated', { room: result.room });
        }
      });

      // Notificar a sala que o jogador desconectou (mas ainda no grace period)
      const updatedRoom = roomManager.getRoom(roomInfo.code);
      if (updatedRoom) {
        io.to(roomInfo.code).emit('room:updated', { room: updatedRoom });
      }
    });
  });
}

/**
 * Lida com a saída intencional de um jogador (room:leave).
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {import('../rooms/RoomManager')} roomManager
 */
function handlePlayerLeave(io, socket, roomManager) {
  const roomInfo = roomManager.getRoomBySocket(socket.id);
  if (!roomInfo) {
    socket.emit('room:error', { message: 'Você não está em nenhuma sala.' });
    return;
  }

  const roomCode = roomInfo.code;
  const result = roomManager.leaveRoom(socket.id);

  // Remover da room do Socket.IO
  socket.leave(roomCode);

  if (result.dissolved) {
    // Sala foi dissolvida
    io.to(roomCode).emit('room:dissolved');
    console.log(`[Socket] room:leave — Sala ${roomCode} dissolvida`);
  } else if (result.room) {
    // Notificar jogadores restantes
    if (result.newHost) {
      io.to(roomCode).emit('room:hostChanged', {
        newHostId: result.newHost.id,
        newHostNickname: result.newHost.nickname,
      });
    }
    io.to(roomCode).emit('room:updated', { room: result.room });
  }

  // Confirmar saída ao jogador
  socket.emit('room:left');
  console.log(`[Socket] room:leave — Jogador ${socket.id} saiu da sala ${roomCode}`);
}

module.exports = roomHandler;
