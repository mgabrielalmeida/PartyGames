/* =========================================
   O Impostor — Lógica Client-Side
   ========================================= */
(function () {
  'use strict';

  /* ─── TELAS ──────────────────────────── */
  const $waiting = document.getElementById('screen-waiting');
  const $config  = document.getElementById('screen-config');
  const $role    = document.getElementById('screen-role');
  const $game    = document.getElementById('screen-game');
  const $voting  = document.getElementById('screen-voting');
  const $results = document.getElementById('screen-results');

  /* ─── ELEMENTOS ──────────────────────── */
  const $waitMsg = document.getElementById('wait-msg');
  const $btnCatLoc = document.getElementById('btn-cat-locations');
  const $btnCatWord = document.getElementById('btn-cat-words');
  const $roleTitle = document.getElementById('role-title');
  const $roleCard = document.getElementById('role-card');
  const $roleIcon = document.getElementById('role-icon');
  const $roleName = document.getElementById('role-name');
  const $roleDesc = document.getElementById('role-desc');
  const $btnContinueGame = document.getElementById('btn-continue-game');

  const $gameTimer = document.getElementById('game-timer');
  const $boardInnocent = document.getElementById('board-innocent');
  const $boardImpostor = document.getElementById('board-impostor');
  const $dynamicRoleTitle = document.getElementById('dynamic-role-title');
  const $innocentHintText = document.getElementById('innocent-hint-text');
  const $gameLocationName = document.getElementById('game-location-name');
  const $impostorInfoText = document.getElementById('impostor-info-text');
  const $impostorListTitle = document.getElementById('impostor-list-title');
  const $suspicionTbody = document.getElementById('suspicion-tbody');
  const $locationsGrid = document.getElementById('locations-grid');
  
  const $btnOpenVoteInnocent = document.getElementById('btn-open-vote-innocent');
  const $btnOpenVoteImpostor = document.getElementById('btn-open-vote-impostor');
  const $impostorVoteHint = document.getElementById('impostor-vote-hint');

  const $votingReason = document.getElementById('voting-reason');
  const $voteCountdown = document.getElementById('vote-countdown');
  const $votePlayersGrid = document.getElementById('vote-players-grid');
  const $voteConfirmedMsg = document.getElementById('vote-confirmed-msg');
  const $voteProgressFill = document.getElementById('vote-progress-fill');
  const $voteProgressText = document.getElementById('vote-progress-text');

  const $resultsHeader = document.getElementById('results-header');
  const $resultsTitle = document.getElementById('results-title');
  const $resultsSubtitle = document.getElementById('results-subtitle');
  const $resultImpostorName = document.getElementById('result-impostor-name');
  const $resultTargetTitle = document.getElementById('result-target-title');
  const $resultLocationName = document.getElementById('result-location-name');
  const $resultsVotesList = document.getElementById('results-votes-list');
  const $resultsActions = document.getElementById('results-actions');
  const $resultsWaiting = document.getElementById('results-waiting');

  const $btnEndGame = document.getElementById('btn-end-game');
  const $btnPlayAgain = document.getElementById('btn-play-again');
  const $btnEndGameResults = document.getElementById('btn-end-game-results');

  /* ─── ESTADO ─────────────────────────── */
  let roomCode = sessionStorage.getItem('party_room_code') || '----';
  let isHost = sessionStorage.getItem('party_is_host') === 'true';
  let globalTimerInterval = null;
  let voteTimerInterval = null;
  let hasVoted = false;

  /* ─── TOAST ──────────────────────────── */
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('exit');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ─── NAVEGAÇÃO ──────────────────────── */
  function showScreen(screen) {
    [$waiting, $config, $role, $game, $voting, $results].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }

  function updateRoomCodes() {
    document.querySelectorAll('.room-code-display').forEach(el => {
      el.textContent = roomCode;
    });
  }

  /* ─── RENDERERS ──────────────────────── */

  function renderSuspicionTable() {
    $suspicionTbody.innerHTML = '';
    const room = PartySocket.currentRoom;
    if (!room) return;

    room.players.forEach(p => {
      if (p.id === PartySocket.mySocketId) return; // Nao se inclui

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(p.nickname)}</td>
        <td class="level-col">
            <div class="suspicion-radio-group">
                <input type="radio" name="suspicion-${p.id}" id="s1-${p.id}" value="1" class="suspicion-radio">
                <label for="s1-${p.id}" class="suspicion-label lvl-1"></label>
            </div>
        </td>
        <td class="level-col">
            <div class="suspicion-radio-group">
                <input type="radio" name="suspicion-${p.id}" id="s2-${p.id}" value="2" class="suspicion-radio">
                <label for="s2-${p.id}" class="suspicion-label lvl-2"></label>
            </div>
        </td>
        <td class="level-col">
            <div class="suspicion-radio-group">
                <input type="radio" name="suspicion-${p.id}" id="s3-${p.id}" value="3" class="suspicion-radio">
                <label for="s3-${p.id}" class="suspicion-label lvl-3"></label>
            </div>
        </td>
      `;
      $suspicionTbody.appendChild(tr);
    });
  }

  function renderLocationsGrid(locations) {
    $locationsGrid.innerHTML = '';
    locations.forEach(loc => {
      const btn = document.createElement('button');
      btn.className = 'loc-btn';
      btn.textContent = loc;
      btn.addEventListener('click', () => {
        btn.classList.toggle('crossed');
      });
      $locationsGrid.appendChild(btn);
    });
  }

  function startGlobalTimer(startTime) {
    clearInterval(globalTimerInterval);
    const LIMIT = 10 * 60 * 1000;
    const ENABLE_VOTE_TIME = 5 * 60 * 1000;

    function tick() {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, LIMIT - elapsed);

      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      $gameTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      if (remaining <= 60000) {
        $gameTimer.style.color = '#e74c3c';
        $gameTimer.classList.add('pulse');
      } else {
        $gameTimer.style.color = '#f1c40f';
        $gameTimer.classList.remove('pulse');
      }

      // Habilitar botao do impostor
      if (elapsed >= ENABLE_VOTE_TIME) {
        $btnOpenVoteImpostor.disabled = false;
        $btnOpenVoteImpostor.classList.add('pulse');
        $impostorVoteHint.textContent = 'Você já pode forçar a votação!';
      } else {
        $btnOpenVoteImpostor.disabled = true;
        const remainingToEnable = ENABLE_VOTE_TIME - elapsed;
        const minE = Math.floor(remainingToEnable / 60000);
        const secE = Math.floor((remainingToEnable % 60000) / 1000);
        $impostorVoteHint.textContent = `Ficará disponível em ${minE}:${secE.toString().padStart(2,'0')}`;
      }

      if (remaining <= 0) {
        clearInterval(globalTimerInterval);
      }
    }

    tick();
    globalTimerInterval = setInterval(tick, 1000);
  }

  function startVoteTimer(deadline) {
    clearInterval(voteTimerInterval);
    function tick() {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      $voteCountdown.textContent = `${remaining}s`;
      if (remaining <= 0) {
        clearInterval(voteTimerInterval);
      }
    }
    tick();
    voteTimerInterval = setInterval(tick, 1000);
  }

  function renderVotingPlayers() {
    $votePlayersGrid.innerHTML = '';
    hasVoted = false;
    $voteConfirmedMsg.style.display = 'none';

    const room = PartySocket.currentRoom;
    if (!room) return;

    room.players.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'vote-player-btn';
      btn.textContent = escapeHtml(p.nickname) + (p.id === PartySocket.mySocketId ? ' (Você)' : '');
      
      btn.addEventListener('click', () => {
        if (hasVoted) return;
        hasVoted = true;

        btn.classList.add('selected');
        $votePlayersGrid.querySelectorAll('.vote-player-btn').forEach(b => {
          if (b !== btn) b.disabled = true;
        });

        $voteConfirmedMsg.style.display = 'block';
        PartySocket.emit('impostor:castVote', { targetId: p.id });
      });

      $votePlayersGrid.appendChild(btn);
    });
  }

  /* ─── EVENT LISTENER BUTTONS ─────────── */
  if ($btnCatLoc) {
    $btnCatLoc.addEventListener('click', () => {
      PartySocket.emit('impostor:startGame', { category: 'locations' });
    });
  }
  if ($btnCatWord) {
    $btnCatWord.addEventListener('click', () => {
      PartySocket.emit('impostor:startGame', { category: 'words' });
    });
  }

  $btnContinueGame.addEventListener('click', () => {
    showScreen($game);
  });

  $btnOpenVoteInnocent.addEventListener('click', () => {
    PartySocket.emit('impostor:openVote');
  });

  $btnOpenVoteImpostor.addEventListener('click', () => {
    PartySocket.emit('impostor:openVote');
  });

  $btnEndGame.addEventListener('click', () => {
    if (confirm('Encerrar o jogo e voltar ao lobby?')) {
      PartySocket.emit('impostor:end');
    }
  });

  $btnEndGameResults.addEventListener('click', () => {
    PartySocket.emit('impostor:end');
  });

  $btnPlayAgain.addEventListener('click', () => {
    PartySocket.emit('impostor:startGame');
  });

  /* ─── SOCKET EVENT HANDLERS ──────────── */

  PartySocket.connect();

  PartySocket.callbacks.onConnected = () => {
    const savedCode = sessionStorage.getItem('party_room_code');
    const savedNickname = sessionStorage.getItem('party_nickname');

    if (savedCode && savedNickname) {
      roomCode = savedCode;
      updateRoomCodes();
      if (isHost) $btnEndGame.style.display = 'block';

      PartySocket.rejoinRoom(savedCode, savedNickname);
    }
  };

  PartySocket.callbacks.onRoomRejoined = () => {
    PartySocket.emit('impostor:sync');
  };

  PartySocket.on('impostor:waitingForStart', () => {
    if (isHost) {
      showScreen($config);
    } else {
      if ($waitMsg) $waitMsg.innerHTML = 'Aguardando o anfitrião configurar a partida<span class="dots">...</span>';
      showScreen($waiting);
    }
  });

  PartySocket.on('impostor:stateSynced', (data) => {
    if (data.phase === 'IN_GAME') {
      // Mostrar revelação de papel antes do tabuleiro (como se fosse gameStarted)
      setupGameBoard(data);
      startGlobalTimer(data.gameStartTime);
      showRoleReveal(data);
    } else if (data.phase === 'VOTING') {
      $votingReason.textContent = 'Votação em andamento.';
      renderVotingPlayers();
      startVoteTimer(data.voteDeadline);
      showScreen($voting);
    } else if (data.phase === 'RESULTS') {
      showResults(data.results);
    }
  });

  PartySocket.on('impostor:gameStarted', (data) => {
    setupGameBoard(data);
    startGlobalTimer(data.gameStartTime);
    showRoleReveal(data);
  });

  function showRoleReveal(data) {
    $roleCard.className = 'role-card revealed ' + (data.role === 'IMPOSTOR' ? 'impostor' : 'innocent');
    const isLoc = data.category !== 'words';
    
    if (data.role === 'IMPOSTOR') {
      $roleIcon.textContent = '🕵️';
      $roleName.textContent = 'IMPOSTOR';
      $roleDesc.textContent = 'Minta. Engane. Vença.';
    } else {
      $roleIcon.textContent = isLoc ? '📍' : '📝';
      $roleName.textContent = 'INOCENTE';
      $roleDesc.textContent = (isLoc ? 'Local: ' : 'Palavra: ') + data.targetItem;
    }
    $btnContinueGame.style.display = 'inline-block';
    showScreen($role);
  }

  function setupGameBoard(data) {
    const isLoc = data.category !== 'words';
    
    // Textos dinâmicos
    if ($dynamicRoleTitle) $dynamicRoleTitle.textContent = isLoc ? '📍 Seu Local' : '📝 Sua Palavra';
    if ($innocentHintText) $innocentHintText.textContent = isLoc ? 'Descubra quem não conhece este lugar.' : 'Descubra quem não conhece esta palavra.';
    if ($impostorInfoText) $impostorInfoText.textContent = isLoc ? 'Minta e tente descobrir o verdadeiro local usando a lista abaixo.' : 'Minta e tente descobrir a verdadeira palavra usando a lista abaixo.';
    if ($impostorListTitle) $impostorListTitle.textContent = isLoc ? '🗺️ Lista de Locais' : '📜 Lista de Palavras';

    if (data.role === 'IMPOSTOR') {
      $boardInnocent.style.display = 'none';
      $boardImpostor.style.display = 'flex';
      renderLocationsGrid(data.allItems);
    } else {
      $boardInnocent.style.display = 'flex';
      $boardImpostor.style.display = 'none';
      $gameLocationName.textContent = data.targetItem;
      renderSuspicionTable();
    }
  }

  PartySocket.on('impostor:votingOpened', (data) => {
    $votingReason.textContent = `${data.initiatorName} abriu a votação. Descubra o impostor!`;
    renderVotingPlayers();
    startVoteTimer(data.deadline);
    $voteProgressFill.style.width = '0%';
    $voteProgressText.textContent = `0/${PartySocket.currentRoom.players.length} votaram`;
    showScreen($voting);
  });

  PartySocket.on('impostor:voteProgress', (data) => {
    const pct = data.totalPlayers > 0 ? (data.totalVotes / data.totalPlayers) * 100 : 0;
    $voteProgressFill.style.width = `${pct}%`;
    $voteProgressText.textContent = `${data.totalVotes}/${data.totalPlayers} votaram`;
  });

  PartySocket.on('impostor:results', (data) => {
    showResults(data);
  });

  function showResults(data) {
    clearInterval(globalTimerInterval);
    clearInterval(voteTimerInterval);

    $resultsHeader.className = 'results-header ' + (data.winners === 'IMPOSTOR' ? 'impostor' : 'innocents');
    if (data.winners === 'IMPOSTOR') {
      $resultsTitle.textContent = 'VITÓRIA DO IMPOSTOR';
      if (data.isTie) $resultsSubtitle.textContent = 'A votação terminou empatada.';
      else $resultsSubtitle.textContent = 'Vocês votaram em um inocente!';
    } else {
      $resultsTitle.textContent = 'VITÓRIA DOS INOCENTES';
      $resultsSubtitle.textContent = 'O impostor foi descoberto!';
    }

    $resultImpostorName.textContent = escapeHtml(data.impostorNickname);
    const isLoc = data.category !== 'words';
    if ($resultTargetTitle) {
      $resultTargetTitle.textContent = isLoc ? '📍 O Local verdadeiro era:' : '📝 A Palavra verdadeira era:';
    }
    $resultLocationName.textContent = data.targetItem;

    $resultsVotesList.innerHTML = '';
    for (const [targetId, votes] of Object.entries(data.votesCount)) {
      const room = PartySocket.currentRoom;
      const player = room ? room.players.find(p => p.id === targetId) : null;
      const nick = player ? escapeHtml(player.nickname) : 'Desconhecido';

      const li = document.createElement('li');
      li.innerHTML = `<span>${nick}</span> <span>${votes} voto(s) ${targetId === data.impostorId ? '🕵️' : ''}</span>`;
      $resultsVotesList.appendChild(li);
    }

    if (isHost) {
      $resultsActions.style.display = 'block';
      $resultsWaiting.style.display = 'none';
    } else {
      $resultsActions.style.display = 'none';
      $resultsWaiting.style.display = 'block';
    }

    showScreen($results);
  }

  PartySocket.on('impostor:ended', () => {
    clearInterval(globalTimerInterval);
    clearInterval(voteTimerInterval);
    showToast('O jogo foi encerrado.', 'info');
    setTimeout(() => {
      window.location.href = '../../../multi-device.html';
    }, 1500);
  });

  PartySocket.callbacks.onRoomError = (data) => {
    showToast(data.message, 'error');
  };

  PartySocket.callbacks.onHostChanged = (data) => {
    if (data.newHostId === PartySocket.mySocketId) {
      isHost = true;
      showToast('Você agora é o anfitrião!', 'info');
      if ($game.classList.contains('active')) $btnEndGame.style.display = 'block';
      if ($results.classList.contains('active')) {
        $resultsActions.style.display = 'block';
        $resultsWaiting.style.display = 'none';
      }
    }
  };

  PartySocket.callbacks.onRoomDissolved = () => {
    clearInterval(globalTimerInterval);
    clearInterval(voteTimerInterval);
    showToast('A sala foi encerrada.', 'error');
    setTimeout(() => {
      window.location.href = '../../../multi-device.html';
    }, 1500);
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    updateRoomCodes();

    if ($waitMsg) {
      $waitMsg.innerHTML = isHost ? 'Sincronizando... para jogar configure a partida' : 'Sincronizando com a partida<span class="dots">...</span>';
    }

    // O game state eh criado via evento no sync
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
