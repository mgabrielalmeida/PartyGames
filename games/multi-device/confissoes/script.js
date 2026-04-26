/* =========================================
   Confissões — Lógica Client-Side
   ========================================= */
(function () {
  'use strict';

  /* ─── TELAS ──────────────────────────── */
  const $waiting      = document.getElementById('screen-waiting');
  const $reveal       = document.getElementById('screen-reveal');
  const $storytelling = document.getElementById('screen-storytelling');
  const $results      = document.getElementById('screen-results');

  /* ─── ELEMENTOS — Waiting ────────────── */
  const $waitMsg = document.getElementById('wait-msg');

  /* ─── ELEMENTOS — Reveal ─────────────── */
  const $revealRoundInfo   = document.getElementById('reveal-round-info');
  const $revealCard        = document.getElementById('reveal-card');
  const $revealIcon        = document.getElementById('reveal-icon');
  const $revealRoleLabel   = document.getElementById('reveal-role-label');
  const $revealWord        = document.getElementById('reveal-word');
  const $revealTruthSection = document.getElementById('reveal-truth-section');
  const $revealTruthValue  = document.getElementById('reveal-truth-value');
  const $revealHint        = document.getElementById('reveal-hint');
  const $btnRevealContinue = document.getElementById('btn-reveal-continue');

  /* ─── ELEMENTOS — Storytelling ────────── */
  const $storytellingRoundBadge = document.getElementById('storytelling-round-badge');
  const $storytellingMasterName = document.getElementById('storytelling-master-name');
  const $storytellingWord       = document.getElementById('storytelling-word');
  const $boardMaster            = document.getElementById('board-master');
  const $boardVoter             = document.getElementById('board-voter');
  const $storytellingTruthInd   = document.getElementById('storytelling-truth-indicator');
  const $storytellingTruthVal   = document.getElementById('storytelling-truth-value');
  const $btnVoteTruth           = document.getElementById('btn-vote-truth');
  const $btnVoteLie             = document.getElementById('btn-vote-lie');
  const $voteConfirmedMsg       = document.getElementById('vote-confirmed-msg');

  /* ─── ELEMENTOS — Results ─────────────── */
  const $resultsTruthBadge  = document.getElementById('results-truth-badge');
  const $resultsWord        = document.getElementById('results-word');
  const $resultsMasterName  = document.getElementById('results-master-name');
  const $resultsWinnersList = document.getElementById('results-winners-list');
  const $resultsLosersList  = document.getElementById('results-losers-list');
  const $resultsActions     = document.getElementById('results-actions');
  const $resultsWaiting     = document.getElementById('results-waiting');
  const $btnNextRound       = document.getElementById('btn-next-round');
  const $btnEndGame         = document.getElementById('btn-end-game');

  /* ─── ESTADO ─────────────────────────── */
  let roomCode = sessionStorage.getItem('party_room_code') || '----';
  let isHost   = sessionStorage.getItem('party_is_host') === 'true';
  let hasVoted = false;
  let currentRoundData = null;

  /* ─── SOM ────────────────────────────── */
  const clickSound = new Audio('../../../assets/audio/click.mp3');
  clickSound.volume = 0.5;

  function playClick() {
    clickSound.cloneNode(true).play().catch(() => {});
  }

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
    [$waiting, $reveal, $storytelling, $results].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }

  function updateRoomCodes() {
    document.querySelectorAll('.room-code-display').forEach(el => {
      el.textContent = roomCode;
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ─── RENDER: Reveal Screen ──────────── */
  function showRoleReveal(data) {
    currentRoundData = data;

    $revealRoundInfo.textContent = `Rodada ${data.roundNumber} de ${data.totalRounds}`;

    if (data.isMaster) {
      $revealCard.className = 'reveal-card master';
      $revealIcon.textContent = '🎤';
      $revealRoleLabel.textContent = 'VOCÊ É O MESTRE';
      $revealHint.textContent = 'Conte uma história que contenha a palavra abaixo.';

      // Mostrar valor verdade/mentira
      $revealTruthSection.style.display = 'block';
      if (data.truthValue) {
        $revealTruthSection.className = 'reveal-truth-section truth';
        $revealTruthValue.textContent = '✅ CONTE UMA VERDADE';
      } else {
        $revealTruthSection.className = 'reveal-truth-section lie';
        $revealTruthValue.textContent = '❌ INVENTE UMA MENTIRA';
      }
    } else {
      $revealCard.className = 'reveal-card player';
      $revealIcon.textContent = '🤔';
      $revealRoleLabel.textContent = 'VOCÊ É JUIZ';
      $revealHint.textContent = `${escapeHtml(data.masterNickname)} vai contar uma história. Será verdade ou mentira?`;

      // Esconder valor verdade/mentira
      $revealTruthSection.style.display = 'none';
    }

    $revealWord.textContent = data.word;
    $btnRevealContinue.style.display = 'inline-flex';
    showScreen($reveal);
  }

  /* ─── RENDER: Storytelling Screen ────── */
  function showStorytelling(data) {
    hasVoted = false;
    $voteConfirmedMsg.style.display = 'none';
    $btnVoteTruth.disabled = false;
    $btnVoteLie.disabled = false;
    $btnVoteTruth.classList.remove('selected');
    $btnVoteLie.classList.remove('selected');

    $storytellingRoundBadge.textContent = `Rodada ${data.roundNumber} de ${data.totalRounds}`;
    $storytellingMasterName.textContent = escapeHtml(data.masterNickname);
    $storytellingWord.textContent = data.word;

    if (data.isMaster) {
      // Mostrar board do mestre
      $boardMaster.style.display = 'block';
      $boardVoter.style.display = 'none';

      if (data.truthValue) {
        $storytellingTruthInd.className = 'truth-indicator truth';
        $storytellingTruthVal.textContent = '✅ CONTE UMA VERDADE';
      } else {
        $storytellingTruthInd.className = 'truth-indicator lie';
        $storytellingTruthVal.textContent = '❌ INVENTE UMA MENTIRA';
      }
    } else {
      // Mostrar board do votante
      $boardMaster.style.display = 'none';
      $boardVoter.style.display = 'block';
    }

    showScreen($storytelling);
  }

  /* ─── RENDER: Results Screen ─────────── */
  function showResults(data) {
    // Verdade ou mentira
    if (data.truthValue) {
      $resultsTruthBadge.className = 'truth-reveal-badge truth';
      $resultsTruthBadge.textContent = '✅ VERDADE';
    } else {
      $resultsTruthBadge.className = 'truth-reveal-badge lie';
      $resultsTruthBadge.textContent = '❌ MENTIRA';
    }

    $resultsWord.textContent = data.word;
    $resultsMasterName.textContent = escapeHtml(data.masterNickname);

    // Vencedores
    $resultsWinnersList.innerHTML = '';
    if (data.winners && data.winners.length > 0) {
      data.winners.forEach(w => {
        const li = document.createElement('li');
        li.className = 'results-player-item winner';
        li.innerHTML = `<span class="results-player-name">${escapeHtml(w.nickname)}</span><span>🏆</span>`;
        $resultsWinnersList.appendChild(li);
      });
    } else {
      $resultsWinnersList.innerHTML = '<li class="results-player-item"><span class="results-player-name" style="color:var(--text-muted);font-style:italic;">Ninguém venceu</span></li>';
    }

    // Perdedores
    $resultsLosersList.innerHTML = '';
    if (data.losers && data.losers.length > 0) {
      data.losers.forEach(l => {
        const li = document.createElement('li');
        li.className = 'results-player-item loser';
        li.innerHTML = `
          <span class="results-player-name">${escapeHtml(l.nickname)}</span>
          <span class="results-player-reason">${escapeHtml(l.reason)}</span>
        `;
        $resultsLosersList.appendChild(li);
      });
    } else {
      $resultsLosersList.innerHTML = '<li class="results-player-item"><span class="results-player-name" style="color:var(--text-muted);font-style:italic;">Ninguém perdeu</span></li>';
    }

    // Ações do host
    if (isHost) {
      $resultsActions.style.display = 'flex';
      $resultsWaiting.style.display = 'none';
    } else {
      $resultsActions.style.display = 'none';
      $resultsWaiting.style.display = 'block';
    }

    showScreen($results);
  }

  /* ─── EVENT LISTENERS — Botões ────────── */

  $btnRevealContinue.addEventListener('click', () => {
    playClick();
    if (currentRoundData) {
      showStorytelling(currentRoundData);
    }
  });

  $btnVoteTruth.addEventListener('click', () => {
    if (hasVoted) return;
    hasVoted = true;
    playClick();

    $btnVoteTruth.classList.add('selected');
    $btnVoteTruth.disabled = true;
    $btnVoteLie.disabled = true;
    $voteConfirmedMsg.style.display = 'block';

    PartySocket.emit('confissoes:vote', { vote: true });
  });

  $btnVoteLie.addEventListener('click', () => {
    if (hasVoted) return;
    hasVoted = true;
    playClick();

    $btnVoteLie.classList.add('selected');
    $btnVoteTruth.disabled = true;
    $btnVoteLie.disabled = true;
    $voteConfirmedMsg.style.display = 'block';

    PartySocket.emit('confissoes:vote', { vote: false });
  });

  $btnNextRound.addEventListener('click', () => {
    playClick();
    PartySocket.emit('confissoes:nextRound');
  });

  $btnEndGame.addEventListener('click', () => {
    playClick();
    PartySocket.emit('confissoes:end');
  });

  /* ─── SOCKET EVENT HANDLERS ──────────── */

  PartySocket.connect();

  PartySocket.callbacks.onConnected = () => {
    const savedCode = sessionStorage.getItem('party_room_code');
    const savedNickname = sessionStorage.getItem('party_nickname');

    if (savedCode && savedNickname) {
      roomCode = savedCode;
      updateRoomCodes();
      PartySocket.rejoinRoom(savedCode, savedNickname);
    }
  };

  PartySocket.callbacks.onRoomRejoined = () => {
    isHost = PartySocket.isHost;
    PartySocket.emit('confissoes:sync');
  };

  // Esperando o host iniciar
  PartySocket.on('confissoes:waitingForStart', () => {
    if (isHost) {
      // Host inicia a primeira rodada automaticamente
      PartySocket.emit('confissoes:startRound');
    } else {
      if ($waitMsg) $waitMsg.innerHTML = 'Aguardando o anfitrião iniciar a rodada<span class="dots">...</span>';
      showScreen($waiting);
    }
  });

  // Rodada iniciada — mostra revelação
  PartySocket.on('confissoes:roundStarted', (data) => {
    showRoleReveal(data);
  });

  // Voto confirmado
  PartySocket.on('confissoes:voteConfirmed', () => {
    // Já tratamos visualmente no click handler
  });

  // Resultados da rodada
  PartySocket.on('confissoes:roundResults', (data) => {
    showResults(data);
  });

  // Jogo encerrado
  PartySocket.on('confissoes:ended', () => {
    showToast('O jogo foi encerrado.', 'info');
    setTimeout(() => {
      window.location.href = '../../../multi-device.html';
    }, 1500);
  });

  // Erros
  PartySocket.callbacks.onRoomError = (data) => {
    showToast(data.message, 'error');
  };

  // Host mudou
  PartySocket.callbacks.onHostChanged = (data) => {
    if (data.newHostId === PartySocket.mySocketId) {
      isHost = true;
      showToast('Você agora é o anfitrião!', 'info');
      if ($results.classList.contains('active')) {
        $resultsActions.style.display = 'flex';
        $resultsWaiting.style.display = 'none';
      }
    }
  };

  // Sala dissolvida
  PartySocket.callbacks.onRoomDissolved = () => {
    showToast('A sala foi encerrada.', 'error');
    setTimeout(() => {
      window.location.href = '../../../multi-device.html';
    }, 1500);
  };

  /* ─── INICIALIZAÇÃO ──────────────────── */
  function init() {
    updateRoomCodes();

    if ($waitMsg) {
      $waitMsg.innerHTML = isHost
        ? 'Sincronizando<span class="dots">...</span>'
        : 'Sincronizando com a partida<span class="dots">...</span>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
