/* =========================================
   MÍMICA — Lógica Principal
   ========================================= */

// --- CONSTANTES ---
const TOTAL_CASAS = 30;
const TIMER_DURACAO = 60; // segundos
const CIRCUNFERENCIA_TIMER = 2 * Math.PI * 45; // 283

const ICONES_EQUIPES = ['🔴', '🔵', '🟢', '🟡'];

const CASAS_HARD = [7, 15, 23];   // Casas que são "Hard!" (índice 0-based)
const CASAS_ALL  = [5, 13, 21];   // Casas que são "All!"

// --- CATEGORIAS E PALAVRAS ---
const CATEGORIAS = {
    'Eu Sou': [
        'Médico', 'Gato', 'Bebê', 'Palhaço', 'Bailarina', 'Zumbi', 'Vovó',
        'Cantor', 'Astronauta', 'Cachorro', 'Surfista', 'Ninja', 'Robô',
        'Vampiro', 'Pirata', 'Professor', 'Jogador de futebol', 'Pinguim',
        'Macaco', 'Mágico', 'Cozinheiro', 'Dentista', 'Presidente',
        'Super-herói', 'Bombeiro', 'Samurai', 'Papai Noel', 'Fantasma',
        'Estátua', 'Modelo', 'Cowboy', 'Múmia', 'Fada', 'Tubarão',
        'Gêmeos', 'Míope', 'Careca', 'Gigante', 'Anão', 'Sonâmbulo'
    ],
    'Eu Faço': [
        'Tomar banho', 'Dormir', 'Cozinhar', 'Nadar', 'Dirigir',
        'Escovar os dentes', 'Dançar forró', 'Andar de bicicleta',
        'Tirar selfie', 'Cortar cebola', 'Passar roupa', 'Pescar',
        'Pintar um quadro', 'Jogar videogame', 'Trocar uma lâmpada',
        'Pular corda', 'Fazer flexão', 'Rir muito', 'Chorar de rir',
        'Escalar montanha', 'Lavar louça', 'Empinar pipa', 'Assobiar',
        'Correr de alguém', 'Tropeçar', 'Espirrar', 'Fazer malabarismo',
        'Abrir um presente', 'Tomar café quente', 'Pentear o cabelo',
        'Dar cambalhotas', 'Fazer yoga', 'Ligar o ventilador', 'Varrer a casa'
    ],
    'Entretenimento': [
        'Titanic', 'Harry Potter', 'Homem-Aranha', 'Frozen', 'Mario',
        'Mickey Mouse', 'Shrek', 'Rei Leão', 'Batman', 'Vingadores',
        'Bob Esponja', 'Toy Story', 'Star Wars', 'Jurassic Park',
        'Macarena', 'Pokémon', 'Sonic', 'Dragon Ball', 'Chaves',
        'Pac-Man', 'Scooby-Doo', 'Tom e Jerry', 'Capitão América',
        'Aladdin', 'Procurando Nemo', 'A Bela e a Fera', 'Minecraft',
        'Fortnite', 'Pega-pega', 'Esconde-esconde', 'Dança das cadeiras',
        'Karaokê', 'Roda roda', 'Circo', 'Show de mágica'
    ],
    'Objetos': [
        'Guarda-chuva', 'Escada', 'Espelho', 'Televisão', 'Relógio',
        'Guitarra', 'Microfone', 'Binóculo', 'Tesoura', 'Martelo',
        'Violão', 'Skate', 'Patins', 'Helicóptero', 'Foguete',
        'Câmera', 'Telefone', 'Ventilador', 'Máquina de lavar',
        'Bicicleta', 'Motocicleta', 'Piano', 'Bateria', 'Flauta',
        'Lanterna', 'Vara de pescar', 'Raquete', 'Óculos', 'Chapéu',
        'Geladeira', 'Secador de cabelo', 'Aspirador de pó', 'Controle remoto',
        'Mochila', 'Panela', 'Frigideira', 'Garrafa', 'Escova de dentes'
    ]
};

const NOMES_CATEGORIAS = Object.keys(CATEGORIAS);

// --- ESTADO DO JOGO ---
const estado = {
    equipes: [],          // { nome, icone, posicao, pontos }
    equipeAtualIdx: 0,    // Índice da equipe jogando
    categoriaAtual: '',
    palavraAtual: '',
    timerInterval: null,
    timerRestante: 0,
    faseRodada: 'aguardando', // 'aguardando' | 'mostrando' | 'cronometro' | 'resultado'
    tipoRodada: 'normal',    // 'normal' | 'hard' | 'all'
    palavrasUsadas: new Set(),
    jogoFinalizado: false,
};

// --- REFERÊNCIAS AO DOM ---
const DOM = {
    // Telas
    telaSetup: document.getElementById('tela-setup'),
    telaJogo: document.getElementById('tela-jogo'),

    // Setup
    numEquipes: document.getElementById('num-equipes'),
    btnMinus: document.getElementById('btn-minus'),
    btnPlus: document.getElementById('btn-plus'),
    btnIniciar: document.getElementById('btn-iniciar'),

    // Jogo
    tabuleiro: document.getElementById('tabuleiro'),
    equipesContainer: document.getElementById('equipes-container'),
    rodadaCard: document.getElementById('rodada-card'),
    categoriaTexto: document.getElementById('categoria-texto'),
    palavraTexto: document.getElementById('palavra-texto'),
    palavraContainer: document.getElementById('palavra-container'),
    timerContainer: document.getElementById('timer-container'),
    timerProgress: document.getElementById('timer-progress'),
    timerText: document.getElementById('timer-text'),
    rodadaBotoes: document.getElementById('rodada-botoes'),
    btnOk: document.getElementById('btn-ok'),

    // Modal Equipe
    modalEquipe: document.getElementById('modal-equipe'),
    modalEquipes: document.getElementById('modal-equipes'),
    modalCancelar: document.getElementById('modal-cancelar'),

    // Modal Fim
    modalFim: document.getElementById('modal-fim'),
    fimIcone: document.getElementById('fim-icone'),
    fimTitulo: document.getElementById('fim-titulo'),
    fimMensagem: document.getElementById('fim-mensagem'),
    btnNovoJogo: document.getElementById('btn-novo-jogo'),

    // Mensagem Flutuante
    mensagemPontos: document.getElementById('mensagem-pontos'),
};

// --- UTILITÁRIOS ---
function sortear(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function rolarDado() {
    return Math.floor(Math.random() * 6) + 1;
}

function mostrarTela(tela) {
    document.body.classList.remove('page-loaded');
    document.body.classList.add('page-exit');

    setTimeout(() => {
        document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
        tela.classList.add('ativa');

        document.body.classList.remove('page-exit');
        setTimeout(() => {
            document.body.classList.add('page-loaded');
        }, 50);
    }, 400);
}

function mostrarMensagemPontos(texto, tipo) {
    const el = DOM.mensagemPontos;
    el.textContent = texto;
    el.className = 'mensagem-pontos mostrar ' + tipo;

    setTimeout(() => {
        el.classList.remove('mostrar');
    }, 1200);
}

// =========================================
//  TELA 1: SETUP
// =========================================

let numEquipesVal = 2;

DOM.btnMinus.addEventListener('click', () => {
    if (numEquipesVal > 2) {
        numEquipesVal--;
        DOM.numEquipes.textContent = numEquipesVal;
    }
});

DOM.btnPlus.addEventListener('click', () => {
    if (numEquipesVal < 4) {
        numEquipesVal++;
        DOM.numEquipes.textContent = numEquipesVal;
    }
});

DOM.btnIniciar.addEventListener('click', () => {
    estado.equipes = [];
    for (let i = 0; i < numEquipesVal; i++) {
        estado.equipes.push({
            nome: `Equipe ${i + 1}`,
            icone: ICONES_EQUIPES[i],
            posicao: 0, // Casa 0 = início
            pontos: 0,
        });
    }
    estado.equipeAtualIdx = 0;
    estado.palavrasUsadas.clear();
    estado.jogoFinalizado = false;

    montarTabuleiro();
    montarEquipes();
    mostrarTela(DOM.telaJogo);

    // Inicia a primeira rodada após a transição
    setTimeout(() => {
        iniciarRodada();
    }, 500);
});

// =========================================
//  TABULEIRO
// =========================================

function montarTabuleiro() {
    DOM.tabuleiro.innerHTML = '';

    for (let i = 0; i < TOTAL_CASAS; i++) {
        const casa = document.createElement('div');
        casa.className = 'casa';
        casa.id = `casa-${i}`;

        // Classifica a casa
        if (i === 0) {
            casa.classList.add('casa-start');
        } else if (i === TOTAL_CASAS - 1) {
            casa.classList.add('casa-finish');
        } else if (CASAS_HARD.includes(i)) {
            casa.classList.add('casa-hard');
        } else if (CASAS_ALL.includes(i)) {
            casa.classList.add('casa-all');
        }

        // Número da casa
        const num = document.createElement('span');
        num.className = 'casa-num';
        num.textContent = i;
        casa.appendChild(num);

        // Container dos ícones
        const iconesDiv = document.createElement('div');
        iconesDiv.className = 'casa-icones';
        iconesDiv.id = `icones-casa-${i}`;
        casa.appendChild(iconesDiv);

        DOM.tabuleiro.appendChild(casa);
    }

    atualizarIconesTabuleiro();
}

function atualizarIconesTabuleiro() {
    // Limpar todos os ícones
    for (let i = 0; i < TOTAL_CASAS; i++) {
        const iconesDiv = document.getElementById(`icones-casa-${i}`);
        if (iconesDiv) iconesDiv.innerHTML = '';
    }

    // Colocar ícones nas posições
    estado.equipes.forEach((eq) => {
        const iconesDiv = document.getElementById(`icones-casa-${eq.posicao}`);
        if (iconesDiv) {
            const span = document.createElement('span');
            span.className = 'icone-tabuleiro';
            span.textContent = eq.icone;
            iconesDiv.appendChild(span);
        }
    });
}

// =========================================
//  EQUIPES (Cards laterais)
// =========================================

function montarEquipes() {
    DOM.equipesContainer.innerHTML = '';

    estado.equipes.forEach((eq, i) => {
        const card = document.createElement('div');
        card.className = 'equipe-card' + (i === estado.equipeAtualIdx ? ' ativa' : '');
        card.id = `equipe-card-${i}`;
        card.innerHTML = `
            <span class="equipe-icone">${eq.icone}</span>
            <div class="equipe-info">
                <div class="equipe-nome">${eq.nome}</div>
                <div class="equipe-posicao">Casa ${eq.posicao}/${TOTAL_CASAS - 1}</div>
            </div>
            <span class="equipe-pontos" id="eq-pontos-${i}">🎲 ${eq.posicao}</span>
        `;
        DOM.equipesContainer.appendChild(card);
    });
}

function atualizarEquipes() {
    estado.equipes.forEach((eq, i) => {
        const card = document.getElementById(`equipe-card-${i}`);
        if (!card) return;

        if (i === estado.equipeAtualIdx) {
            card.classList.add('ativa');
        } else {
            card.classList.remove('ativa');
        }

        card.querySelector('.equipe-posicao').textContent = `Casa ${eq.posicao}/${TOTAL_CASAS - 1}`;
        document.getElementById(`eq-pontos-${i}`).textContent = `🎲 ${eq.posicao}`;
    });
}

// =========================================
//  LÓGICA DE RODADA
// =========================================

function iniciarRodada() {
    if (estado.jogoFinalizado) return;

    const equipeAtual = estado.equipes[estado.equipeAtualIdx];

    // Determinar tipo de rodada pela casa atual
    const posAtual = equipeAtual.posicao;
    if (CASAS_HARD.includes(posAtual)) {
        estado.tipoRodada = 'hard';
    } else if (CASAS_ALL.includes(posAtual)) {
        estado.tipoRodada = 'all';
    } else {
        estado.tipoRodada = 'normal';
    }

    // Sortear categoria
    if (estado.tipoRodada === 'hard') {
        // Hard: Sorteia de todas as categorias
        estado.categoriaAtual = sortear(NOMES_CATEGORIAS);
    } else {
        estado.categoriaAtual = sortear(NOMES_CATEGORIAS);
    }

    // Sortear palavra (evitando repetidas)
    let palavras = CATEGORIAS[estado.categoriaAtual];
    let palavrasDisponiveis = palavras.filter(p => !estado.palavrasUsadas.has(p));
    if (palavrasDisponiveis.length === 0) {
        // Resetar se todas foram usadas
        estado.palavrasUsadas.clear();
        palavrasDisponiveis = [...palavras];
    }
    estado.palavraAtual = sortear(palavrasDisponiveis);
    estado.palavrasUsadas.add(estado.palavraAtual);

    // Atualizar UI
    DOM.categoriaTexto.textContent = estado.categoriaAtual;
    DOM.palavraTexto.textContent = estado.palavraAtual;
    DOM.palavraTexto.classList.remove('oculta');

    // Mostrar/ocultar badges de tipo
    atualizarBadgeRodada();

    // Timer escondido
    DOM.timerContainer.style.display = 'none';
    pararTimer();

    // Mostrar botão OK
    DOM.rodadaBotoes.innerHTML = `
        <button id="btn-ok" class="btn-primario">OK — Começar Timer</button>
    `;
    document.getElementById('btn-ok').addEventListener('click', onOkClick);

    estado.faseRodada = 'mostrando';

    atualizarEquipes();
    atualizarIconesTabuleiro();
}

function atualizarBadgeRodada() {
    // Remover badges existentes
    const existente = DOM.rodadaCard.querySelector('.rodada-tipo-badge');
    if (existente) existente.remove();

    if (estado.tipoRodada === 'hard') {
        const badge = document.createElement('span');
        badge.className = 'rodada-tipo-badge badge-hard';
        badge.textContent = '⚡ HARD — Todas as categorias';
        DOM.rodadaCard.insertBefore(badge, DOM.rodadaCard.firstChild);
    } else if (estado.tipoRodada === 'all') {
        const badge = document.createElement('span');
        badge.className = 'rodada-tipo-badge badge-all';
        badge.textContent = '🌟 ALL — Todas equipes podem pontuar';
        DOM.rodadaCard.insertBefore(badge, DOM.rodadaCard.firstChild);
    }
}

function onOkClick() {
    // Ocultar palavra
    DOM.palavraTexto.classList.add('oculta');

    // Mostrar timer
    DOM.timerContainer.style.display = 'flex';
    iniciarTimer();

    // Mostrar botão "Acertou!"
    if (estado.tipoRodada === 'all') {
        DOM.rodadaBotoes.innerHTML = `
            <button id="btn-acertou" class="btn-acertou">✅ Acertou!</button>
        `;
        document.getElementById('btn-acertou').addEventListener('click', onAcertouAll);
    } else {
        DOM.rodadaBotoes.innerHTML = `
            <button id="btn-acertou" class="btn-acertou">✅ ${estado.equipes[estado.equipeAtualIdx].nome} Acertou!</button>
        `;
        document.getElementById('btn-acertou').addEventListener('click', onAcertouNormal);
    }

    estado.faseRodada = 'cronometro';
}

// =========================================
//  TIMER
// =========================================

function iniciarTimer() {
    estado.timerRestante = TIMER_DURACAO;
    DOM.timerText.textContent = estado.timerRestante;
    DOM.timerProgress.style.strokeDasharray = CIRCUNFERENCIA_TIMER;
    DOM.timerProgress.style.strokeDashoffset = 0;
    DOM.timerProgress.classList.remove('warning', 'danger');

    estado.timerInterval = setInterval(() => {
        estado.timerRestante--;
        DOM.timerText.textContent = estado.timerRestante;

        // Atualizar anel visual
        const progresso = 1 - (estado.timerRestante / TIMER_DURACAO);
        DOM.timerProgress.style.strokeDashoffset = CIRCUNFERENCIA_TIMER * progresso;

        // Cores de alerta
        if (estado.timerRestante <= 10) {
            DOM.timerProgress.classList.add('danger');
            DOM.timerProgress.classList.remove('warning');
        } else if (estado.timerRestante <= 20) {
            DOM.timerProgress.classList.add('warning');
        }

        if (estado.timerRestante <= 0) {
            pararTimer();
            onTempoEsgotado();
        }
    }, 1000);
}

function pararTimer() {
    if (estado.timerInterval) {
        clearInterval(estado.timerInterval);
        estado.timerInterval = null;
    }
}

// =========================================
//  AÇÕES DE FIM DE RODADA
// =========================================

function onAcertouNormal() {
    pararTimer();

    const equipe = estado.equipes[estado.equipeAtualIdx];
    const dado = rolarDado();

    // Revelar palavra
    DOM.palavraTexto.classList.remove('oculta');

    // Mover equipe
    moverEquipe(estado.equipeAtualIdx, dado);

    // Mensagem
    mostrarMensagemPontos(`+${dado}`, 'positivo');

    // Mostrar resultado
    mostrarResultadoRodada(equipe, dado, true);
}

function onAcertouAll() {
    pararTimer();

    // Revelar palavra
    DOM.palavraTexto.classList.remove('oculta');

    // Abrir modal para selecionar equipe
    abrirModalEquipe();
}

function onTempoEsgotado() {
    pararTimer();

    // Revelar palavra
    DOM.palavraTexto.classList.remove('oculta');

    // Ninguém acertou
    mostrarMensagemPontos('⏰', 'negativo');

    mostrarResultadoRodada(null, 0, false);
}

function moverEquipe(indice, casas) {
    const equipe = estado.equipes[indice];
    equipe.posicao = Math.min(equipe.posicao + casas, TOTAL_CASAS - 1);

    atualizarIconesTabuleiro();
    atualizarEquipes();

    // Verificar vitória
    if (equipe.posicao >= TOTAL_CASAS - 1) {
        estado.jogoFinalizado = true;
        setTimeout(() => fimDeJogo(equipe), 1200);
    }
}

function mostrarResultadoRodada(equipe, dado, acertou) {
    estado.faseRodada = 'resultado';

    let html = '';

    if (acertou && equipe) {
        html = `
            <div class="dado-resultado">
                <span class="dado-label">${equipe.icone} ${equipe.nome} acertou!</span>
                <span class="dado-numero">🎲 ${dado}</span>
                <span class="dado-label">casa${dado > 1 ? 's' : ''} avançada${dado > 1 ? 's' : ''}</span>
            </div>
            <button id="btn-proxima" class="btn-primario">Próxima Rodada</button>
        `;
    } else {
        html = `
            <div class="dado-resultado">
                <span class="dado-numero">⏰</span>
                <span class="dado-label">Tempo esgotado! Nenhuma equipe avança.</span>
            </div>
            <button id="btn-proxima" class="btn-primario">Próxima Rodada</button>
        `;
    }

    DOM.rodadaBotoes.innerHTML = html;
    document.getElementById('btn-proxima').addEventListener('click', proximaRodada);
}

function proximaRodada() {
    if (estado.jogoFinalizado) return;

    // Avançar para próxima equipe
    estado.equipeAtualIdx = (estado.equipeAtualIdx + 1) % estado.equipes.length;

    iniciarRodada();
}

// =========================================
//  MODAL: Selecionar equipe (rodada ALL)
// =========================================

function abrirModalEquipe() {
    DOM.modalEquipes.innerHTML = '';

    estado.equipes.forEach((eq, i) => {
        const btn = document.createElement('button');
        btn.className = 'modal-jogador-btn';
        btn.innerHTML = `${eq.icone} ${eq.nome}`;
        btn.addEventListener('click', () => onEquipeSelecionada(i));
        DOM.modalEquipes.appendChild(btn);
    });

    DOM.modalEquipe.classList.add('ativo');
}

DOM.modalCancelar.addEventListener('click', () => {
    DOM.modalEquipe.classList.remove('ativo');
    // Ninguém acertou no All
    mostrarMensagemPontos('❌', 'negativo');
    mostrarResultadoRodada(null, 0, false);
});

function onEquipeSelecionada(indice) {
    DOM.modalEquipe.classList.remove('ativo');

    const equipe = estado.equipes[indice];
    const dado = rolarDado();

    moverEquipe(indice, dado);
    mostrarMensagemPontos(`+${dado}`, 'positivo');
    mostrarResultadoRodada(equipe, dado, true);
}

// =========================================
//  FIM DO JOGO
// =========================================

function fimDeJogo(equipeVencedora) {
    DOM.fimIcone.textContent = '🏆';
    DOM.fimTitulo.textContent = `${equipeVencedora.icone} ${equipeVencedora.nome} Venceu!`;
    DOM.fimMensagem.textContent = `A equipe chegou à casa final do tabuleiro!`;

    DOM.modalFim.classList.add('ativo');
}

DOM.btnNovoJogo.addEventListener('click', () => {
    DOM.modalFim.classList.remove('ativo');
    mostrarTela(DOM.telaSetup);
});
