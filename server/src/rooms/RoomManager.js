/* =========================================
   RoomManager.js — Módulo Genérico de Salas
   =========================================
   Gerencia criação, entrada, saída e ciclo de vida
   de salas para qualquer jogo multi-device.
   ========================================= */

/**
 * @typedef {Object} Player
 * @property {string} nickname - Nome de exibição do jogador
 * @property {'HOST'|'PLAYER'} role - Papel do jogador na sala
 * @property {boolean} connected - Se o jogador está atualmente conectado
 * @property {number} joinedAt - Timestamp de quando entrou
 */

/**
 * @typedef {Object} Room
 * @property {string} code - Código único de 4 letras da sala
 * @property {string} host - Socket ID do host atual
 * @property {Map<string, Player>} players - Mapa de socketId → Player
 * @property {'LOBBY'|'IN_GAME'|'FINISHED'} state - Estado atual da sala
 * @property {Object|null} gameState - Estado específico do jogo (gerenciado pelo handler do jogo)
 * @property {string|null} gameId - Identificador do jogo selecionado
 * @property {number} maxPlayers - Limite máximo de jogadores
 * @property {number} createdAt - Timestamp de criação
 * @property {number} lastActivity - Timestamp da última atividade
 * @property {number} inactivityTimeout - Tempo máximo de inatividade (ms)
 */

class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} Código da sala → Room */
    this.rooms = new Map();

    /** @type {Map<string, string>} Socket ID → Código da sala (índice reverso) */
    this.socketToRoom = new Map();

    /** @type {Map<string, NodeJS.Timeout>} Socket ID → Timeout de desconexão */
    this.disconnectTimers = new Map();

    /** @type {NodeJS.Timeout|null} Timer de limpeza periódica */
    this._cleanupInterval = null;

    // Caracteres permitidos para códigos de sala (sem O, I, 0, 1 para evitar ambiguidade)
    this.CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    this.CODE_LENGTH = 4;

    // Grace period de reconexão (ms)
    this.RECONNECT_GRACE_PERIOD = 30000; // 30 segundos
  }

  /* -----------------------------------------
     GERAÇÃO DE CÓDIGO
     ----------------------------------------- */

  /**
   * Gera um código de sala único de 4 letras maiúsculas.
   * Evita caracteres ambíguos (O, I) para facilitar comunicação verbal.
   * @returns {string} Código único da sala
   * @private
   */
  _generateCode() {
    let code;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      code = '';
      for (let i = 0; i < this.CODE_LENGTH; i++) {
        code += this.CODE_CHARS.charAt(
          Math.floor(Math.random() * this.CODE_CHARS.length)
        );
      }
      attempts++;

      // Proteção contra loop infinito (improvável com 24^4 = 331.776 combinações)
      if (attempts >= maxAttempts) {
        throw new Error('Não foi possível gerar um código de sala único após várias tentativas.');
      }
    } while (this.rooms.has(code));

    return code;
  }

  /* -----------------------------------------
     SANITIZAÇÃO
     ----------------------------------------- */

  /**
   * Sanitiza uma string removendo HTML e limitando o comprimento.
   * @param {string} str - String a sanitizar
   * @param {number} [maxLength=20] - Comprimento máximo
   * @returns {string} String sanitizada
   * @private
   */
  _sanitize(str, maxLength = 20) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/[<>\"'&]/g, '') // Remove caracteres perigosos de HTML
      .trim()
      .substring(0, maxLength);
  }

  /* -----------------------------------------
     SERIALIZAÇÃO
     ----------------------------------------- */

  /**
   * Converte uma sala para um objeto serializável (sem Maps).
   * Usado para enviar dados ao frontend via Socket.IO.
   * @param {Room} room - A sala a serializar
   * @returns {Object} Sala serializada
   */
  serializeRoom(room) {
    if (!room) return null;

    const players = [];
    room.players.forEach((player, socketId) => {
      players.push({
        id: socketId,
        nickname: player.nickname,
        role: player.role,
        connected: player.connected,
      });
    });

    return {
      code: room.code,
      host: room.host,
      players,
      state: room.state,
      gameId: room.gameId,
      maxPlayers: room.maxPlayers,
      playerCount: players.length,
    };
  }

  /* -----------------------------------------
     CRIAÇÃO DE SALA
     ----------------------------------------- */

  /**
   * Cria uma nova sala com o jogador como HOST.
   * @param {string} hostSocketId - Socket ID do criador
   * @param {string} nickname - Nome de exibição do host
   * @param {Object} [options] - Opções de configuração
   * @param {number} [options.maxPlayers=10] - Limite de jogadores
   * @param {number} [options.inactivityTimeout=1800000] - Timeout de inatividade (30 min)
   * @returns {{ code: string, room: Object }} Código e dados da sala criada
   * @throws {Error} Se o jogador já está em uma sala
   */
  createRoom(hostSocketId, nickname, options = {}) {
    // Verificar se o jogador já está em uma sala
    if (this.socketToRoom.has(hostSocketId)) {
      throw new Error('Você já está em uma sala. Saia antes de criar outra.');
    }

    const sanitizedNickname = this._sanitize(nickname);
    if (!sanitizedNickname || sanitizedNickname.length < 1) {
      throw new Error('Nickname inválido. Use entre 1 e 20 caracteres.');
    }

    const code = this._generateCode();
    const now = Date.now();

    /** @type {Room} */
    const room = {
      code,
      host: hostSocketId,
      players: new Map(),
      state: 'LOBBY',
      gameState: null,
      gameId: null,
      maxPlayers: options.maxPlayers || 10,
      createdAt: now,
      lastActivity: now,
      inactivityTimeout: options.inactivityTimeout || 1800000, // 30 minutos
    };

    // Adicionar o host como primeiro jogador
    room.players.set(hostSocketId, {
      nickname: sanitizedNickname,
      role: 'HOST',
      connected: true,
      joinedAt: now,
    });

    this.rooms.set(code, room);
    this.socketToRoom.set(hostSocketId, code);

    console.log(`[RoomManager] Sala ${code} criada por "${sanitizedNickname}" (${hostSocketId})`);

    return { code, room: this.serializeRoom(room) };
  }

  /* -----------------------------------------
     ENTRADA NA SALA
     ----------------------------------------- */

  /**
   * Adiciona um jogador a uma sala existente.
   * @param {string} code - Código da sala
   * @param {string} socketId - Socket ID do jogador
   * @param {string} nickname - Nome de exibição do jogador
   * @returns {{ room: Object }} Dados atualizados da sala
   * @throws {Error} Se a sala não existe, está cheia, em andamento, ou nickname duplicado
   */
  joinRoom(code, socketId, nickname) {
    // Verificar se o jogador já está em outra sala
    if (this.socketToRoom.has(socketId)) {
      throw new Error('Você já está em uma sala. Saia antes de entrar em outra.');
    }

    const normalizedCode = (code || '').toUpperCase().trim();
    const room = this.rooms.get(normalizedCode);

    if (!room) {
      throw new Error('Sala não encontrada. Verifique o código e tente novamente.');
    }

    if (room.state !== 'LOBBY') {
      throw new Error('Esta sala já está em jogo. Aguarde a próxima partida.');
    }

    if (room.players.size >= room.maxPlayers) {
      throw new Error(`Sala lotada (máximo ${room.maxPlayers} jogadores).`);
    }

    const sanitizedNickname = this._sanitize(nickname);
    if (!sanitizedNickname || sanitizedNickname.length < 1) {
      throw new Error('Nickname inválido. Use entre 1 e 20 caracteres.');
    }

    // Verificar nickname duplicado na sala
    for (const [, player] of room.players) {
      if (player.nickname.toLowerCase() === sanitizedNickname.toLowerCase()) {
        throw new Error('Já existe um jogador com esse nome nesta sala.');
      }
    }

    room.players.set(socketId, {
      nickname: sanitizedNickname,
      role: 'PLAYER',
      connected: true,
      joinedAt: Date.now(),
    });

    room.lastActivity = Date.now();
    this.socketToRoom.set(socketId, normalizedCode);

    console.log(`[RoomManager] "${sanitizedNickname}" (${socketId}) entrou na sala ${normalizedCode}`);

    return { room: this.serializeRoom(room) };
  }

  /* -----------------------------------------
     RECONEXÃO / REJOIN
     ----------------------------------------- */

  /**
   * Permite que um jogador com novo socket ID retome seu lugar na sala.
   * Usado quando o navegador navega para uma nova página (ex: lobby → jogo),
   * destruindo a conexão antiga e criando uma nova com socket ID diferente.
   *
   * @param {string} code - Código da sala
   * @param {string} newSocketId - Novo socket ID do jogador
   * @param {string} nickname - Nickname do jogador (para identificação)
   * @returns {{ room: Object, isHost: boolean }} Dados da sala e se é host
   * @throws {Error} Se a sala não existe ou nickname não encontrado
   */
  rejoinRoom(code, newSocketId, nickname) {
    const normalizedCode = (code || '').toUpperCase().trim();
    const room = this.rooms.get(normalizedCode);

    if (!room) {
      throw new Error('Sala não encontrada.');
    }

    const sanitizedNickname = this._sanitize(nickname);
    if (!sanitizedNickname) {
      throw new Error('Nickname inválido.');
    }

    // Procurar jogador existente pelo nickname
    let oldSocketId = null;
    let existingPlayer = null;

    for (const [socketId, player] of room.players) {
      if (player.nickname.toLowerCase() === sanitizedNickname.toLowerCase()) {
        oldSocketId = socketId;
        existingPlayer = player;
        break;
      }
    }

    if (!oldSocketId || !existingPlayer) {
      throw new Error('Jogador não encontrado nesta sala.');
    }

    // Se o socket ID já é o mesmo, apenas marcar como conectado
    if (oldSocketId === newSocketId) {
      existingPlayer.connected = true;
      this.cancelDisconnect(oldSocketId);
      return { room: this.serializeRoom(room), isHost: room.host === newSocketId };
    }

    // Transferir o jogador do antigo socket para o novo
    const playerData = {
      nickname: existingPlayer.nickname,
      role: existingPlayer.role,
      connected: true,
      joinedAt: existingPlayer.joinedAt,
    };

    // Cancelar timer de desconexão do antigo socket
    this._clearDisconnectTimer(oldSocketId);

    // Remover antigo mapeamento
    room.players.delete(oldSocketId);
    this.socketToRoom.delete(oldSocketId);

    // Adicionar com novo socket ID
    room.players.set(newSocketId, playerData);
    this.socketToRoom.set(newSocketId, normalizedCode);

    // Atualizar host se necessário
    if (room.host === oldSocketId) {
      room.host = newSocketId;
    }

    room.lastActivity = Date.now();

    console.log(`[RoomManager] "${sanitizedNickname}" rejoin: ${oldSocketId} → ${newSocketId} na sala ${normalizedCode}`);

    return {
      room: this.serializeRoom(room),
      isHost: room.host === newSocketId,
    };
  }

  /* -----------------------------------------
     SAÍDA DA SALA
     ----------------------------------------- */

  /**
   * Remove um jogador de sua sala atual.
   * Se o jogador era HOST, transfere o papel para o próximo jogador.
   * Se a sala ficar vazia, a destrói.
   *
   * @param {string} socketId - Socket ID do jogador
   * @returns {{ roomCode: string, dissolved: boolean, newHost: { id: string, nickname: string }|null, room: Object|null }}
   */
  leaveRoom(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (!code) {
      return { roomCode: null, dissolved: false, newHost: null, room: null };
    }

    const room = this.rooms.get(code);
    if (!room) {
      this.socketToRoom.delete(socketId);
      return { roomCode: code, dissolved: false, newHost: null, room: null };
    }

    const wasHost = room.host === socketId;
    const leavingPlayer = room.players.get(socketId);
    const leavingNickname = leavingPlayer ? leavingPlayer.nickname : 'Desconhecido';

    // Remover jogador
    room.players.delete(socketId);
    this.socketToRoom.delete(socketId);

    // Cancelar qualquer timer de desconexão pendente
    this._clearDisconnectTimer(socketId);

    console.log(`[RoomManager] "${leavingNickname}" (${socketId}) saiu da sala ${code}`);

    // Se a sala ficou vazia, destruir
    if (room.players.size === 0) {
      this.destroyRoom(code);
      return { roomCode: code, dissolved: true, newHost: null, room: null };
    }

    // Se o HOST saiu, transferir para o jogador mais antigo
    let newHost = null;
    if (wasHost) {
      newHost = this._transferHost(room);
    }

    room.lastActivity = Date.now();

    return {
      roomCode: code,
      dissolved: false,
      newHost,
      room: this.serializeRoom(room),
    };
  }

  /* -----------------------------------------
     TRANSFERÊNCIA DE HOST
     ----------------------------------------- */

  /**
   * Transfere o papel de HOST para o jogador mais antigo na sala.
   * @param {Room} room - A sala
   * @returns {{ id: string, nickname: string }|null} Dados do novo host
   * @private
   */
  _transferHost(room) {
    // Encontrar o jogador conectado mais antigo
    let oldestJoinTime = Infinity;
    let newHostId = null;

    for (const [socketId, player] of room.players) {
      if (player.connected && player.joinedAt < oldestJoinTime) {
        oldestJoinTime = player.joinedAt;
        newHostId = socketId;
      }
    }

    // Se não encontrou nenhum conectado, pegar qualquer um
    if (!newHostId) {
      newHostId = room.players.keys().next().value;
    }

    if (!newHostId) return null;

    // Atualizar papéis
    for (const [, player] of room.players) {
      player.role = 'PLAYER';
    }

    const newHostPlayer = room.players.get(newHostId);
    newHostPlayer.role = 'HOST';
    room.host = newHostId;

    console.log(`[RoomManager] HOST transferido para "${newHostPlayer.nickname}" (${newHostId}) na sala ${room.code}`);

    return { id: newHostId, nickname: newHostPlayer.nickname };
  }

  /* -----------------------------------------
     INÍCIO DE JOGO
     ----------------------------------------- */

  /**
   * Inicia o jogo na sala, mudando o estado para IN_GAME.
   * Apenas o HOST pode chamar esta função.
   * @param {string} code - Código da sala
   * @param {string} socketId - Socket ID de quem está iniciando (deve ser HOST)
   * @returns {{ room: Object }} Dados atualizados da sala
   * @throws {Error} Se não é HOST, sala não existe, ou condições não são atendidas
   */
  startGame(code, socketId) {
    const room = this.rooms.get(code);

    if (!room) {
      throw new Error('Sala não encontrada.');
    }

    if (room.host !== socketId) {
      throw new Error('Apenas o HOST pode iniciar o jogo.');
    }

    if (room.state !== 'LOBBY') {
      throw new Error('O jogo já está em andamento.');
    }

    if (room.players.size < 2) {
      throw new Error('É necessário pelo menos 2 jogadores para iniciar.');
    }

    room.state = 'IN_GAME';
    room.lastActivity = Date.now();

    console.log(`[RoomManager] Jogo iniciado na sala ${code} com ${room.players.size} jogadores`);

    return { room: this.serializeRoom(room) };
  }

  /* -----------------------------------------
     SELEÇÃO DE JOGO
     ----------------------------------------- */

  /**
   * Define o jogo selecionado para a sala (apenas HOST, apenas no LOBBY).
   * @param {string} code - Código da sala
   * @param {string} socketId - Socket ID de quem está selecionando
   * @param {string} gameId - Identificador do jogo
   * @returns {{ room: Object }}
   * @throws {Error}
   */
  selectGame(code, socketId, gameId) {
    const room = this.rooms.get(code);

    if (!room) throw new Error('Sala não encontrada.');
    if (room.host !== socketId) throw new Error('Apenas o HOST pode selecionar o jogo.');
    if (room.state !== 'LOBBY') throw new Error('Não é possível trocar de jogo durante a partida.');

    const sanitizedGameId = this._sanitize(gameId, 50);
    if (!sanitizedGameId) throw new Error('ID de jogo inválido.');

    room.gameId = sanitizedGameId;
    room.lastActivity = Date.now();

    console.log(`[RoomManager] Jogo "${sanitizedGameId}" selecionado na sala ${code}`);

    return { room: this.serializeRoom(room) };
  }

  /* -----------------------------------------
     CONSULTAS
     ----------------------------------------- */

  /**
   * Retorna os dados serializados de uma sala.
   * @param {string} code - Código da sala
   * @returns {Object|null} Sala serializada ou null
   */
  getRoom(code) {
    const room = this.rooms.get(code);
    return room ? this.serializeRoom(room) : null;
  }

  /**
   * Retorna os dados brutos (com Map) de uma sala — para uso interno.
   * @param {string} code - Código da sala
   * @returns {Room|null}
   */
  getRoomRaw(code) {
    return this.rooms.get(code) || null;
  }

  /**
   * Encontra a sala de um jogador pelo socket ID.
   * @param {string} socketId - Socket ID do jogador
   * @returns {{ code: string, room: Object }|null}
   */
  getRoomBySocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;

    const room = this.rooms.get(code);
    if (!room) {
      this.socketToRoom.delete(socketId);
      return null;
    }

    return { code, room: this.serializeRoom(room) };
  }

  /* -----------------------------------------
     DESCONEXÃO COM GRACE PERIOD
     ----------------------------------------- */

  /**
   * Agenda a remoção de um jogador após o grace period de reconexão.
   * Marca o jogador como desconectado imediatamente.
   * @param {string} socketId - Socket ID do jogador
   * @param {function} onRemove - Callback chamado se o jogador for efetivamente removido
   */
  scheduleDisconnect(socketId, onRemove) {
    const code = this.socketToRoom.get(socketId);
    if (!code) return;

    const room = this.rooms.get(code);
    if (!room) return;

    const player = room.players.get(socketId);
    if (!player) return;

    // Marcar como desconectado imediatamente
    player.connected = false;
    room.lastActivity = Date.now();

    console.log(`[RoomManager] "${player.nickname}" desconectou — grace period de ${this.RECONNECT_GRACE_PERIOD / 1000}s iniciado`);

    // Agendar remoção
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(socketId);

      // Verificar se ainda está desconectado (pode ter reconectado)
      const currentRoom = this.rooms.get(code);
      if (!currentRoom) return;

      const currentPlayer = currentRoom.players.get(socketId);
      if (!currentPlayer || currentPlayer.connected) return;

      console.log(`[RoomManager] Grace period expirou para "${currentPlayer.nickname}" — removendo da sala ${code}`);

      // Chamar o callback antes de remover (para notificar via Socket.IO)
      if (typeof onRemove === 'function') {
        onRemove(socketId, code);
      }
    }, this.RECONNECT_GRACE_PERIOD);

    this.disconnectTimers.set(socketId, timer);
  }

  /**
   * Cancela o timer de desconexão (jogador reconectou).
   * @param {string} socketId - Socket ID do jogador que reconectou
   * @returns {boolean} true se havia um timer para cancelar
   */
  cancelDisconnect(socketId) {
    const hadTimer = this._clearDisconnectTimer(socketId);

    if (hadTimer) {
      const code = this.socketToRoom.get(socketId);
      if (code) {
        const room = this.rooms.get(code);
        if (room) {
          const player = room.players.get(socketId);
          if (player) {
            player.connected = true;
            room.lastActivity = Date.now();
            console.log(`[RoomManager] "${player.nickname}" reconectou dentro do grace period`);
          }
        }
      }
    }

    return hadTimer;
  }

  /**
   * Limpa o timer de desconexão de um jogador.
   * @param {string} socketId
   * @returns {boolean}
   * @private
   */
  _clearDisconnectTimer(socketId) {
    const timer = this.disconnectTimers.get(socketId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(socketId);
      return true;
    }
    return false;
  }

  /* -----------------------------------------
     DESTRUIÇÃO DE SALA
     ----------------------------------------- */

  /**
   * Destrói uma sala e limpa todas as referências.
   * @param {string} code - Código da sala a destruir
   */
  destroyRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return;

    // Limpar índice reverso de todos os jogadores
    for (const [socketId] of room.players) {
      this.socketToRoom.delete(socketId);
      this._clearDisconnectTimer(socketId);
    }

    this.rooms.delete(code);
    console.log(`[RoomManager] Sala ${code} destruída`);
  }

  /**
   * Finaliza o jogo e retorna ao LOBBY.
   * @param {string} code - Código da sala
   */
  finishGame(code) {
    const room = this.rooms.get(code);
    if (!room) return;

    room.state = 'FINISHED';
    room.gameState = null;
    room.lastActivity = Date.now();

    console.log(`[RoomManager] Jogo finalizado na sala ${code}`);
  }

  /**
   * Retorna a sala ao estado LOBBY (para jogar de novo).
   * @param {string} code - Código da sala
   */
  returnToLobby(code) {
    const room = this.rooms.get(code);
    if (!room) return;

    room.state = 'LOBBY';
    room.gameState = null;
    room.gameId = null;
    room.lastActivity = Date.now();

    console.log(`[RoomManager] Sala ${code} retornou ao lobby`);
  }

  /* -----------------------------------------
     LIMPEZA PERIÓDICA
     ----------------------------------------- */

  /**
   * Inicia o intervalo de limpeza de salas inativas.
   * @param {number} [intervalMs=60000] - Intervalo entre limpezas (padrão: 1 min)
   */
  startCleanup(intervalMs = 60000) {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }

    this._cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [code, room] of this.rooms) {
        const elapsed = now - room.lastActivity;

        if (elapsed > room.inactivityTimeout) {
          console.log(`[RoomManager] Sala ${code} inativa por ${Math.round(elapsed / 60000)} min — destruindo`);
          this.destroyRoom(code);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[RoomManager] Limpeza: ${cleaned} sala(s) removida(s). Total ativo: ${this.rooms.size}`);
      }
    }, intervalMs);

    console.log(`[RoomManager] Limpeza periódica iniciada (intervalo: ${intervalMs / 1000}s)`);
  }

  /**
   * Para o intervalo de limpeza.
   */
  stopCleanup() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
  }

  /* -----------------------------------------
     ESTATÍSTICAS (Para debug/admin)
     ----------------------------------------- */

  /**
   * Retorna estatísticas gerais do sistema.
   * @returns {{ totalRooms: number, totalPlayers: number, roomsByState: Object }}
   */
  getStats() {
    const stats = {
      totalRooms: this.rooms.size,
      totalPlayers: this.socketToRoom.size,
      roomsByState: { LOBBY: 0, IN_GAME: 0, FINISHED: 0 },
    };

    for (const [, room] of this.rooms) {
      stats.roomsByState[room.state] = (stats.roomsByState[room.state] || 0) + 1;
    }

    return stats;
  }
}

module.exports = RoomManager;
