/* =========================================
   Votação Anônima — Lógica Client-Side
   =========================================
   Gerencia as telas do jogo de votação,
   interage com PartySocket para eventos
   específicos do jogo (votacao:*).
   ========================================= */
(function () {
  'use strict';

  /* ─── TELAS ──────────────────────────── */
  const $createPoll = document.getElementById('screen-create-poll');
  const $voting     = document.getElementById('screen-voting');
  const $results    = document.getElementById('screen-results');
  const $waiting    = document.getElementById('screen-waiting');

  /* ─── ELEMENTOS — TELA CRIAR PERGUNTA ── */
  const $pollQuestion    = document.getElementById('poll-question');
  const $optionsContainer = document.getElementById('options-container');
  const $btnAddOption    = document.getElementById('btn-add-option');
  const $btnSendPoll     = document.getElementById('btn-send-poll');
  const $btnEndGame      = document.getElementById('btn-end-game');
  const $createRoundNum  = document.getElementById('create-round-num');
  const $createRoomCode  = document.getElementById('create-room-code');

  /* ─── ELEMENTOS — TELA VOTAÇÃO ──────── */
  const $voteQuestion    = document.getElementById('vote-question-text');
  const $voteOptions     = document.getElementById('vote-options');
  const $voteProgressFill = document.getElementById('vote-progress-fill');
  const $voteProgressText = document.getElementById('vote-progress-text');
  const $voteConfirmed   = document.getElementById('vote-confirmed-msg');
  const $voteTimer       = document.getElementById('vote-timer');
  const $voteRoundNum    = document.getElementById('vote-round-num');
  const $voteRoomCode    = document.getElementById('vote-room-code');

  /* ─── ELEMENTOS — TELA RESULTADOS ───── */
  const $resultsBars        = document.getElementById('results-bars');
  const $resultsQuestion    = document.getElementById('results-question-text');
  const $resultsMeta        = document.getElementById('results-meta');
  const $resultsActions     = document.getElementById('results-actions');
  const $resultsWaiting     = document.getElementById('results-waiting');
  const $btnNextRound       = document.getElementById('btn-next-round');
  const $btnEndGameResults  = document.getElementById('btn-end-game-results');
  const $resultsRoundNum    = document.getElementById('results-round-num');
  const $resultsRoomCode    = document.getElementById('results-room-code');

  /* ─── ELEMENTOS — TELA ESPERA ────────── */
  const $waitRoundNum = document.getElementById('wait-round-num');
  const $waitRoomCode = document.getElementById('wait-room-code');
  const $waitProposerName = document.getElementById('wait-proposer-name');

  /* ─── ESTADO ─────────────────────────── */
  let roomCode = sessionStorage.getItem('party_room_code') || '----';
  let isHost = sessionStorage.getItem('party_is_host') === 'true';
  let currentRound = 1;
  let hasVoted = false;
  let timerInterval = null;
  let voteDeadline = null;

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
    [$createPoll, $voting, $results, $waiting].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }

  function updateRoomCodes() {
    [$createRoomCode, $voteRoomCode, $resultsRoomCode, $waitRoomCode].forEach(el => {
      if (el) el.textContent = roomCode;
    });
  }

  function updateRoundNums(round) {
    [$createRoundNum, $voteRoundNum, $resultsRoundNum, $waitRoundNum].forEach(el => {
      if (el) el.textContent = round;
    });
  }

  /* ─── FORMULÁRIO DE OPÇÕES ───────────── */
  function getOptionInputs() {
    return $optionsContainer.querySelectorAll('.option-input');
  }

  function updateRemoveButtons() {
    const rows = $optionsContainer.querySelectorAll('.option-input-row');
    rows.forEach(row => {
      const btn = row.querySelector('.btn-remove-option');
      btn.disabled = rows.length <= 2;
    });
  }

  function addOptionRow() {
    const inputs = getOptionInputs();
    if (inputs.length >= 6) {
      showToast('Máximo de 6 opções.', 'error');
      return;
    }

    const row = document.createElement('div');
    row.className = 'option-input-row';
    row.innerHTML = `
      <input type="text" class="option-input" placeholder="Opção ${inputs.length + 1}" maxlength="100" autocomplete="off">
      <button class="btn-remove-option">✕</button>
    `;

    // Inserir antes do label (que é o primeiro filho)
    // Na verdade queremos inserir antes do botão "adicionar", depois das rows existentes
    const lastRow = $optionsContainer.querySelectorAll('.option-input-row');
    const refNode = lastRow[lastRow.length - 1];
    refNode.insertAdjacentElement('afterend', row);

    row.querySelector('.btn-remove-option').addEventListener('click', () => {
      row.remove();
      updateRemoveButtons();
      validatePollForm();
      renumberPlaceholders();
    });

    row.querySelector('.option-input').addEventListener('input', validatePollForm);

    updateRemoveButtons();

    if (inputs.length + 1 >= 6) {
      $btnAddOption.disabled = true;
    }

    row.querySelector('.option-input').focus();
  }

  function renumberPlaceholders() {
    const inputs = getOptionInputs();
    inputs.forEach((input, i) => {
      input.placeholder = `Opção ${i + 1}`;
    });
    $btnAddOption.disabled = inputs.length >= 6;
  }

  function validatePollForm() {
    const question = $pollQuestion.value.trim();
    const inputs = getOptionInputs();
    let allFilled = true;

    inputs.forEach(inp => {
      if (inp.value.trim().length === 0) allFilled = false;
    });

    $btnSendPoll.disabled = question.length === 0 || !allFilled || inputs.length < 2;
  }

  // Event listeners para criar opções
  $btnAddOption.addEventListener('click', addOptionRow);
  $pollQuestion.addEventListener('input', validatePollForm);

  // Listeners nos inputs iniciais
  $optionsContainer.querySelectorAll('.option-input').forEach(inp => {
    inp.addEventListener('input', validatePollForm);
  });

  // Listeners nos botões de remover iniciais (desabilitados pois tem apenas 2)
  $optionsContainer.querySelectorAll('.btn-remove-option').forEach(btn => {
    btn.addEventListener('click', function () {
      if (getOptionInputs().length <= 2) return;
      this.closest('.option-input-row').remove();
      updateRemoveButtons();
      validatePollForm();
      renumberPlaceholders();
    });
  });

  /* ─── ENVIAR PERGUNTA ────────────────── */
  $btnSendPoll.addEventListener('click', () => {
    const question = $pollQuestion.value.trim();
    const inputs = getOptionInputs();
    const options = Array.from(inputs).map(inp => inp.value.trim());

    if (!question || options.some(o => !o) || options.length < 2) {
      showToast('Preencha todos os campos.', 'error');
      return;
    }

    $btnSendPoll.disabled = true;
    PartySocket.emit('votacao:createPoll', { question, options });
  });

  /* ─── ENCERRAR JOGO ──────────────────── */
  $btnEndGame.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja encerrar o jogo?')) {
      PartySocket.emit('votacao:end');
    }
  });

  $btnEndGameResults.addEventListener('click', () => {
    if (confirm('Encerrar o jogo e voltar ao lobby?')) {
      PartySocket.emit('votacao:end');
    }
  });

  /* ─── PRÓXIMA RODADA ─────────────────── */
  $btnNextRound.addEventListener('click', () => {
    PartySocket.emit('votacao:nextRound');
  });

  /* ─── TIMER DE VOTAÇÃO ───────────────── */
  function startVoteTimer(deadline) {
    voteDeadline = deadline;
    clearInterval(timerInterval);

    function tick() {
      const remaining = Math.max(0, Math.ceil((voteDeadline - Date.now()) / 1000));
      $voteTimer.textContent = `${remaining}s`;

      if (remaining <= 10) {
        $voteTimer.classList.add('urgent');
      } else {
        $voteTimer.classList.remove('urgent');
      }

      if (remaining <= 0) {
        clearInterval(timerInterval);
        $voteTimer.textContent = '0s';
      }
    }

    tick();
    timerInterval = setInterval(tick, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  /* ─── RESETAR FORMULÁRIO ─────────────── */
  function resetPollForm() {
    $pollQuestion.value = '';

    // Remover opções extras (manter apenas 2)
    const rows = $optionsContainer.querySelectorAll('.option-input-row');
    rows.forEach((row, i) => {
      if (i >= 2) row.remove();
    });

    // Limpar as 2 primeiras
    $optionsContainer.querySelectorAll('.option-input').forEach((inp, i) => {
      inp.value = '';
      inp.placeholder = `Opção ${i + 1}`;
    });

    $btnAddOption.disabled = false;
    updateRemoveButtons();
    validatePollForm();
  }

  /* ─── SOCKET EVENTS ──────────────────── */

  PartySocket.connect();

  // Quando conectado, entrar de volta na sala (via sessão)
  PartySocket.callbacks.onConnected = () => {
    // Re-entrar na sala usando os dados da sessão
    const savedCode = sessionStorage.getItem('party_room_code');
    const savedNickname = sessionStorage.getItem('party_nickname');

    if (savedCode && savedNickname) {
      roomCode = savedCode;
      updateRoomCodes();
      // Solicita ao servidor para reconectar
      PartySocket.rejoinRoom(savedCode, savedNickname);
      
      // Quando reconectar, pedir o sync
      setTimeout(() => {
        PartySocket.emit('votacao:sync');
      }, 500); // delay breve pra garantir
    }
  };

  PartySocket.on('votacao:stateSynced', (data) => {
    // Como sync pode ser chamado em refeshes, definimos a rotina
    currentRound = data.round === 0 ? 1 : data.round;
    updateRoundNums(currentRound);

    const isMyTurn = data.proposerId === PartySocket.mySocketId;

    if (data.phase === 'WAITING_QUESTION') {
      if (isMyTurn) {
        resetPollForm();
        showScreen($createPoll);
      } else {
        if ($waitProposerName) {
          $waitProposerName.textContent = `Aguardando ${escapeHtml(data.proposerNickname)} criar a próxima pergunta...`;
        }
        showScreen($waiting);
      }
    } else {
      // Se tiver reconectado no meio da partida
      showScreen($waiting);
    }
  });

  // ── Evento: Pergunta criada ──────────
  PartySocket.on('votacao:pollCreated', (data) => {
    currentRound = data.round;
    hasVoted = false;
    updateRoundNums(data.round);

    // Renderizar tela de votação
    $voteQuestion.textContent = data.question;
    $voteOptions.innerHTML = '';
    $voteConfirmed.style.display = 'none';

    data.options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.className = 'vote-option-btn';
      btn.textContent = option;
      btn.addEventListener('click', () => {
        if (hasVoted) return;
        hasVoted = true;

        // Marcar selecionado
        btn.classList.add('selected');
        $voteOptions.querySelectorAll('.vote-option-btn').forEach(b => {
          if (b !== btn) b.disabled = true;
        });

        $voteConfirmed.style.display = '';
        PartySocket.emit('votacao:vote', { optionIndex: index });
      });
      $voteOptions.appendChild(btn);
    });

    // Progresso
    $voteProgressFill.style.width = '0%';
    $voteProgressText.textContent = `0/${data.totalPlayers} votaram`;

    // Timer
    startVoteTimer(data.deadline);

    // Ir para a tela de votação
    showScreen($voting);
  });

  // ── Evento: Voto confirmado ──────────
  PartySocket.on('votacao:voteConfirmed', () => {
    // Já tratado no click handler
  });

  // ── Evento: Progresso de votos ───────
  PartySocket.on('votacao:voteProgress', (data) => {
    const pct = data.totalPlayers > 0 ? (data.totalVotes / data.totalPlayers) * 100 : 0;
    $voteProgressFill.style.width = `${pct}%`;
    $voteProgressText.textContent = `${data.totalVotes}/${data.totalPlayers} votaram`;
  });

  // ── Evento: Resultados ───────────────
  PartySocket.on('votacao:results', (data) => {
    stopTimer();
    currentRound = data.round;
    updateRoundNums(data.round);

    $resultsQuestion.textContent = `"${data.question}"`;

    // Renderizar barras
    $resultsBars.innerHTML = '';
    data.results.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.style.opacity = '0';

      const medal = index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : index === 2 ? '🥉 ' : '';

      item.innerHTML = `
        <div class="result-header">
          <span class="result-option-name">${medal}${escapeHtml(result.option)}</span>
          <span class="result-votes">${result.votes} voto${result.votes !== 1 ? 's' : ''} (${result.percentage}%)</span>
        </div>
        <div class="result-bar-container">
          <div class="result-bar-fill"></div>
        </div>
      `;

      $resultsBars.appendChild(item);

      // Animar
      setTimeout(() => {
        item.style.opacity = '1';
        const fill = item.querySelector('.result-bar-fill');
        fill.style.width = `${result.percentage}%`;
      }, 150 * (index + 1));
    });

    $resultsMeta.textContent = `${data.totalVotes} de ${data.totalPlayers} jogadores votaram.`;

    // Mostrar ações conforme papel
    if (isHost) {
      $resultsActions.style.display = '';
      $resultsWaiting.style.display = 'none';
    } else {
      $resultsActions.style.display = 'none';
      $resultsWaiting.style.display = '';
    }

    showScreen($results);
  });

  // ── Evento: Próxima rodada ───────────
  PartySocket.on('votacao:nextRound', (data) => {
    currentRound = data.round;
    updateRoundNums(data.round);
    hasVoted = false;

    const isMyTurn = data.proposerId === PartySocket.mySocketId;

    if (isMyTurn) {
      resetPollForm();
      showScreen($createPoll);
    } else {
      if ($waitProposerName) {
        $waitProposerName.textContent = `Aguardando ${escapeHtml(data.proposerNickname)} criar a próxima pergunta...`;
      }
      showScreen($waiting);
    }
  });

  // ── Evento: Jogo encerrado ───────────
  PartySocket.on('votacao:ended', () => {
    stopTimer();
    showToast('O jogo foi encerrado.', 'info');

    // Limpar sessão e voltar ao hub
    setTimeout(() => {
      window.location.href = '../../../multi-device.html';
    }, 1500);
  });

  // ── Evento: Erro ─────────────────────
  PartySocket.callbacks.onRoomError = (data) => {
    showToast(data.message, 'error');
    $btnSendPoll.disabled = false;
  };

  // ── Evento: Host mudou ───────────────
  PartySocket.callbacks.onHostChanged = (data) => {
    if (data.newHostId === PartySocket.mySocketId) {
      isHost = true;
      showToast('Você agora é o anfitrião!', 'info');
    }
  };

  // ── Evento: Sala dissolvida ──────────
  PartySocket.callbacks.onRoomDissolved = () => {
    stopTimer();
    showToast('A sala foi encerrada.', 'error');
    setTimeout(() => {
      window.location.href = '../../../multi-device.html';
    }, 1500);
  };

  /* ─── UTILITÁRIOS ────────────────────── */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ─── INICIALIZAÇÃO ──────────────────── */
  function init() {
    // Tornar o body visível (compatibilidade)

    updateRoomCodes();
    updateRoundNums(1);

    // Ocultar a tela inicial padronizada antes de receber o sync do server
    showScreen($waiting);
    if ($waitProposerName) {
      $waitProposerName.textContent = "Sincronizando com a partida...";
    }
  }

  // Inicializar quando o body carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
