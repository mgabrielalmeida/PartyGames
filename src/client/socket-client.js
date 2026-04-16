/* =========================================
   socket-client.js — Cliente Socket.IO
   =========================================
   Módulo frontend que gerencia a conexão
   Socket.IO e os eventos de sala.
   Expõe a API global: window.PartySocket
   ========================================= */

(function () {
  'use strict';

  /* -----------------------------------------
     ESTADO LOCAL
     ----------------------------------------- */
  let socket = null;
  let currentRoom = null;
  let mySocketId = null;
  let isHost = false;

  /* -----------------------------------------
     CALLBACKS (registrados pelo UI)
     ----------------------------------------- */
  const callbacks = {
    onConnected: null,
    onDisconnected: null,
    onRoomCreated: null,
    onRoomJoined: null,
    onRoomUpdated: null,
    onRoomStarted: null,
    onRoomError: null,
    onRoomRejoined: null,
    onHostChanged: null,
    onRoomDissolved: null,
    onRoomLeft: null,
  };

  /* -----------------------------------------
     CONEXÃO
     ----------------------------------------- */

  /**
   * Inicializa a conexão Socket.IO com o servidor.
   * Detecta automaticamente a URL do servidor.
   */
  function connect() {
    if (socket && socket.connected) {
      console.log('[PartySocket] Já conectado.');
      return;
    }

    // Auto-detect: em produção usa o mesmo host, em dev pode ser diferente
    const serverUrl = window.location.origin;

    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Registrar listeners
    _registerListeners();

    console.log('[PartySocket] Conectando a', serverUrl);
  }

  /**
   * Desconecta do servidor.
   */
  function disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    _resetState();
  }

  /* -----------------------------------------
     AÇÕES (Cliente → Servidor)
     ----------------------------------------- */

  /**
   * Cria uma nova sala.
   * @param {string} nickname - Nome do jogador (host)
   */
  function createRoom(nickname) {
    if (!socket || !socket.connected) {
      _fireCallback('onRoomError', { message: 'Sem conexão com o servidor.' });
      return;
    }
    socket.emit('room:create', { nickname });
  }

  /**
   * Entra em uma sala existente.
   * @param {string} code - Código de 4 letras da sala
   * @param {string} nickname - Nome do jogador
   */
  function joinRoom(code, nickname) {
    if (!socket || !socket.connected) {
      _fireCallback('onRoomError', { message: 'Sem conexão com o servidor.' });
      return;
    }
    socket.emit('room:join', { code: code.toUpperCase().trim(), nickname });
  }

  /**
   * Tenta reconectar a uma sala (após recarregamento de página).
   * @param {string} code - Código da sala
   * @param {string} nickname - Nickname do jogador
   */
  function rejoinRoom(code, nickname) {
    if (!socket || !socket.connected) {
      _fireCallback('onRoomError', { message: 'Sem conexão com o servidor.' });
      return;
    }
    socket.emit('room:rejoin', { code, nickname });
  }

  /**
   * Sai da sala atual.
   */
  function leaveRoom() {
    if (!socket || !socket.connected) return;
    socket.emit('room:leave');
  }

  /**
   * Seleciona um jogo (apenas HOST).
   * @param {string} gameId - ID do jogo
   */
  function selectGame(gameId) {
    if (!socket || !socket.connected) return;
    socket.emit('room:selectGame', { gameId });
  }

  /**
   * Inicia o jogo (apenas HOST).
   */
  function startGame() {
    if (!socket || !socket.connected) return;
    socket.emit('room:start');
  }

  /**
   * Emite um evento genérico (usado por jogos específicos).
   * @param {string} event - Nome do evento
   * @param {Object} [data] - Dados do evento
   */
  function emit(event, data) {
    if (!socket || !socket.connected) return;
    socket.emit(event, data);
  }

  /**
   * Registra um listener para um evento genérico (usado por jogos específicos).
   * @param {string} event - Nome do evento
   * @param {function} callback - Função callback
   */
  function on(event, callback) {
    if (!socket) return;
    socket.on(event, callback);
  }

  /**
   * Remove um listener de evento.
   * @param {string} event
   * @param {function} [callback]
   */
  function off(event, callback) {
    if (!socket) return;
    if (callback) {
      socket.off(event, callback);
    } else {
      socket.removeAllListeners(event);
    }
  }

  /* -----------------------------------------
     LISTENERS (Servidor → Cliente)
     ----------------------------------------- */

  function _registerListeners() {
    socket.on('connect', () => {
      mySocketId = socket.id;
      console.log('[PartySocket] Conectado:', mySocketId);
      _fireCallback('onConnected', { socketId: mySocketId });
    });

    socket.on('disconnect', (reason) => {
      console.log('[PartySocket] Desconectado:', reason);
      _fireCallback('onDisconnected', { reason });
    });

    socket.on('connect_error', (error) => {
      console.error('[PartySocket] Erro de conexão:', error.message);
      _fireCallback('onRoomError', { message: 'Erro de conexão com o servidor.' });
    });

    // ── Eventos de Sala ──────────────────────

    socket.on('room:created', (data) => {
      currentRoom = data.room;
      isHost = true;
      console.log('[PartySocket] Sala criada:', data.code);
      _fireCallback('onRoomCreated', data);
    });

    socket.on('room:joined', (data) => {
      currentRoom = data.room;
      isHost = false;
      console.log('[PartySocket] Entrou na sala');
      _fireCallback('onRoomJoined', data);
    });

    socket.on('room:rejoined', (data) => {
      currentRoom = data.room;
      isHost = data.isHost;
      console.log('[PartySocket] Reconectado à sala');
      _fireCallback('onRoomRejoined', data);
    });

    socket.on('room:updated', (data) => {
      currentRoom = data.room;
      // Atualizar flag de host (pode ter mudado)
      if (currentRoom && mySocketId) {
        isHost = currentRoom.host === mySocketId;
      }
      _fireCallback('onRoomUpdated', data);
    });

    socket.on('room:started', (data) => {
      if (currentRoom) {
        currentRoom.state = 'IN_GAME';
      }
      _fireCallback('onRoomStarted', data);
    });

    socket.on('room:error', (data) => {
      console.warn('[PartySocket] Erro:', data.message);
      _fireCallback('onRoomError', data);
    });

    socket.on('room:hostChanged', (data) => {
      if (data.newHostId === mySocketId) {
        isHost = true;
      }
      console.log('[PartySocket] Novo HOST:', data.newHostNickname);
      _fireCallback('onHostChanged', data);
    });

    socket.on('room:dissolved', () => {
      console.log('[PartySocket] Sala dissolvida');
      _resetState();
      _fireCallback('onRoomDissolved');
    });

    socket.on('room:left', () => {
      _resetState();
      _fireCallback('onRoomLeft');
    });
  }

  /* -----------------------------------------
     UTILITÁRIOS
     ----------------------------------------- */

  function _resetState() {
    currentRoom = null;
    isHost = false;
  }

  function _fireCallback(name, data) {
    if (typeof callbacks[name] === 'function') {
      callbacks[name](data);
    }
  }

  /* -----------------------------------------
     API PÚBLICA — window.PartySocket
     ----------------------------------------- */
  window.PartySocket = {
    // Conexão
    connect,
    disconnect,

    // Ações de sala
    createRoom,
    joinRoom,
    rejoinRoom,
    leaveRoom,
    selectGame,
    startGame,

    // Eventos genéricos (para jogos)
    emit,
    on,
    off,

    // Callbacks de sala
    callbacks,

    // Getters
    get socket() { return socket; },
    get currentRoom() { return currentRoom; },
    get mySocketId() { return mySocketId; },
    get isHost() { return isHost; },
    get connected() { return socket && socket.connected; },
  };

  console.log('[PartySocket] Módulo carregado.');
})();
