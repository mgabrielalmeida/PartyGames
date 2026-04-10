/* =========================================
   JOGO DA FORCA — Lógica Principal
   ========================================= */

// --- CONTEXTOS DISPONÍVEIS ---
const CONTEXTOS = [
    'Filmes', 'Séries', 'Lugares', 'Animais', 'Comidas',
    'Profissões', 'Esportes', 'Músicas', 'Marcas', 'Países',
    'Frutas', 'Objetos', 'Cores', 'Instrumentos', 'Super-Heróis'
];

// --- ESTADO DO JOGO ---
const estado = {
    jogadores: [],        // { nome: string, pontos: number }
    indiceMestre: 0,      // Índice do jogador mestre atual
    palavraSecreta: '',   // Palavra atual (normalizada, sem acentos, uppercase)
    letrasReveladas: [],  // Set de letras já reveladas
    letrasUsadas: [],     // Set de todas as letras tentadas
    erros: 0,             // Número de erros (máx 6)
    contextoAtual: '',    // Contexto da rodada atual
    letraPendente: null,  // Letra clicada aguardando atribuição
    aguardandoJogador: false, // Se está no modal de seleção
    modoAdivinhar: false, // Se está no modal de adivinhar palavra
    palpiteAdivinhar: '', // Palpite de palavra digitado
};

const MAX_ERROS = 6;

// --- REFERÊNCIAS AO DOM ---
const DOM = {
    // Telas
    telaSetup: document.getElementById('tela-setup'),
    telaMestre: document.getElementById('tela-mestre'),
    telaJogo: document.getElementById('tela-jogo'),

    // Setup
    numJogadores: document.getElementById('num-jogadores'),
    btnMinus: document.getElementById('btn-minus'),
    btnPlus: document.getElementById('btn-plus'),
    btnIniciar: document.getElementById('btn-iniciar'),

    // Mestre
    mestreNome: document.getElementById('mestre-nome'),
    contextoTexto: document.getElementById('contexto-texto'),
    inputPalavra: document.getElementById('input-palavra'),
    erroPalavra: document.getElementById('erro-palavra'),
    btnConfirmarPalavra: document.getElementById('btn-confirmar-palavra'),

    // Jogo
    jogoContextoBadge: document.getElementById('jogo-contexto-badge'),
    jogoMestreBadge: document.getElementById('jogo-mestre-badge'),
    placarContainer: document.getElementById('placar-container'),
    forcaCanvas: document.getElementById('forca-canvas'),
    errosCount: document.getElementById('erros-count'),
    palavraDisplay: document.getElementById('palavra-display'),
    teclado: document.getElementById('teclado'),
    btnAdivinhar: document.getElementById('btn-adivinhar'),

    // Modal Jogador
    modalJogador: document.getElementById('modal-jogador'),
    modalTitulo: document.getElementById('modal-titulo'),
    modalJogadores: document.getElementById('modal-jogadores'),
    modalCancelar: document.getElementById('modal-cancelar'),

    // Modal Adivinhar
    modalAdivinhar: document.getElementById('modal-adivinhar'),
    inputAdivinhar: document.getElementById('input-adivinhar'),
    erroAdivinhar: document.getElementById('erro-adivinhar'),
    btnConfirmarAdivinhar: document.getElementById('btn-confirmar-adivinhar'),
    btnCancelarAdivinhar: document.getElementById('btn-cancelar-adivinhar'),

    // Modal Fim
    modalFim: document.getElementById('modal-fim'),
    fimIcone: document.getElementById('fim-icone'),
    fimTitulo: document.getElementById('fim-titulo'),
    fimMensagem: document.getElementById('fim-mensagem'),
    fimPalavra: document.getElementById('fim-palavra'),
    btnProximaRodada: document.getElementById('btn-proxima-rodada'),

    // Mensagem Flutuante
    mensagemPontos: document.getElementById('mensagem-pontos'),
};

// --- UTILITÁRIOS ---

/** Normaliza texto: remove acentos e converte para uppercase */
function normalizar(texto) {
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
}

/** Troca a tela ativa com transição de fade out e fade in */
function mostrarTela(tela) {
    // Inicia o fade out
    document.body.classList.remove('page-loaded');
    document.body.classList.add('page-exit');

    // Aguarda o CSS transition de fade out (400ms definido em global.css)
    setTimeout(() => {
        // Faz a troca de telas no DOM
        document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
        tela.classList.add('ativa');

        // Prepara e inicia o fade in
        document.body.classList.remove('page-exit');
        setTimeout(() => {
            document.body.classList.add('page-loaded');
        }, 50);
    }, 400);
}

/** Mostra mensagem flutuante de pontos */
function mostrarMensagemPontos(texto, tipo) {
    const el = DOM.mensagemPontos;
    el.textContent = texto;
    el.className = 'mensagem-pontos mostrar ' + tipo;

    setTimeout(() => {
        el.classList.remove('mostrar');
    }, 1200);
}

/** Sorteia um item aleatório de um array */
function sortear(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// =========================================
//  TELA 1: SETUP
// =========================================

let numJogadoresVal = 3;

DOM.btnMinus.addEventListener('click', () => {
    if (numJogadoresVal > 2) {
        numJogadoresVal--;
        DOM.numJogadores.textContent = numJogadoresVal;
    }
});

DOM.btnPlus.addEventListener('click', () => {
    if (numJogadoresVal < 8) {
        numJogadoresVal++;
        DOM.numJogadores.textContent = numJogadoresVal;
    }
});

DOM.btnIniciar.addEventListener('click', () => {
    // Criar jogadores
    estado.jogadores = [];
    for (let i = 1; i <= numJogadoresVal; i++) {
        estado.jogadores.push({ nome: `Jogador ${i}`, pontos: 0 });
    }
    estado.indiceMestre = 0;

    iniciarRodada();
});

// =========================================
//  TELA 2: MESTRE
// =========================================

function iniciarRodada() {
    // Sortear contexto
    estado.contextoAtual = sortear(CONTEXTOS);

    // Resetar estado da rodada
    estado.palavraSecreta = '';
    estado.letrasReveladas = new Set();
    estado.letrasUsadas = new Set();
    estado.erros = 0;
    estado.letraPendente = null;
    estado.aguardandoJogador = false;
    estado.modoAdivinhar = false;
    estado.palpiteAdivinhar = '';

    // Atualizar tela do mestre
    const mestre = estado.jogadores[estado.indiceMestre];
    DOM.mestreNome.textContent = mestre.nome;
    DOM.contextoTexto.textContent = estado.contextoAtual;
    DOM.inputPalavra.value = '';
    DOM.erroPalavra.textContent = '';

    mostrarTela(DOM.telaMestre);

    // Foco no input após transição (400ms fade out + 50ms render + fade in)
    setTimeout(() => DOM.inputPalavra.focus(), 800);
}

// Filtrar input: apenas letras e espaços
DOM.inputPalavra.addEventListener('input', () => {
    let val = DOM.inputPalavra.value;
    // Remove tudo que não é letra (com ou sem acento) ou espaço
    val = val.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
    DOM.inputPalavra.value = val;
    DOM.erroPalavra.textContent = '';
});

DOM.btnConfirmarPalavra.addEventListener('click', () => {
    const raw = DOM.inputPalavra.value.trim();

    if (raw.length < 2) {
        DOM.erroPalavra.textContent = 'A palavra deve ter pelo menos 2 letras.';
        DOM.inputPalavra.classList.add('shake');
        setTimeout(() => DOM.inputPalavra.classList.remove('shake'), 400);
        return;
    }

    if (raw.length > 20) {
        DOM.erroPalavra.textContent = 'Máximo de 20 caracteres.';
        return;
    }

    estado.palavraSecreta = normalizar(raw);
    iniciarJogo();
});

// Enter para confirmar
DOM.inputPalavra.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') DOM.btnConfirmarPalavra.click();
});

// =========================================
//  TELA 3: JOGO
// =========================================

function iniciarJogo() {
    // Atualizar badges
    DOM.jogoContextoBadge.textContent = `📂 ${estado.contextoAtual}`;
    DOM.jogoMestreBadge.textContent = `👑 Mestre: ${estado.jogadores[estado.indiceMestre].nome}`;

    // Montar placar
    montarPlacar();

    // Montar palavra display
    montarPalavraDisplay();

    // Montar teclado
    montarTeclado();

    // Desenhar forca base
    desenharForcaBase();

    // Atualizar erros
    DOM.errosCount.textContent = '0';

    mostrarTela(DOM.telaJogo);
}

function montarPlacar() {
    DOM.placarContainer.innerHTML = '';
    estado.jogadores.forEach((j, i) => {
        const div = document.createElement('div');
        div.className = 'placar-jogador' + (i === estado.indiceMestre ? ' mestre' : '');
        div.id = `placar-${i}`;
        div.innerHTML = `
            <div class="pj-nome">${i === estado.indiceMestre ? '👑 ' : ''}${j.nome}</div>
            <div class="pj-pontos">${j.pontos} pts</div>
        `;
        DOM.placarContainer.appendChild(div);
    });
}

function atualizarPlacar() {
    estado.jogadores.forEach((j, i) => {
        const el = document.getElementById(`placar-${i}`);
        if (el) {
            el.querySelector('.pj-pontos').textContent = `${j.pontos} pts`;
        }
    });
}

function montarPalavraDisplay() {
    DOM.palavraDisplay.innerHTML = '';
    for (const char of estado.palavraSecreta) {
        const slot = document.createElement('div');
        if (char === ' ') {
            slot.className = 'letra-slot espaco';
            slot.innerHTML = `<span class="letra-char">&nbsp;</span><div class="letra-line"></div>`;
        } else {
            slot.className = 'letra-slot';
            slot.dataset.letra = char;
            slot.innerHTML = `<span class="letra-char">${char}</span><div class="letra-line"></div>`;
        }
        DOM.palavraDisplay.appendChild(slot);
    }
}

function revelarLetra(letra) {
    estado.letrasReveladas.add(letra);
    const slots = DOM.palavraDisplay.querySelectorAll(`.letra-slot[data-letra="${letra}"]`);
    slots.forEach(slot => {
        const charEl = slot.querySelector('.letra-char');
        charEl.classList.add('revelada');
    });
}

function verificarVitoria() {
    // Todas as letras únicas da palavra (exceto espaços)
    const letrasUnicas = new Set(estado.palavraSecreta.replace(/ /g, '').split(''));
    for (const l of letrasUnicas) {
        if (!estado.letrasReveladas.has(l)) return false;
    }
    return true;
}

function montarTeclado() {
    DOM.teclado.innerHTML = '';
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const l of letras) {
        const btn = document.createElement('button');
        btn.className = 'tecla';
        btn.textContent = l;
        btn.dataset.letra = l;
        btn.addEventListener('click', () => onTeclaClick(l, btn));
        DOM.teclado.appendChild(btn);
    }
}

function onTeclaClick(letra, btnEl) {
    if (estado.letrasUsadas.has(letra)) return;

    estado.letraPendente = letra;
    estado.modoAdivinhar = false;

    // Abrir modal para selecionar jogador
    abrirModalJogador(`Quem palpitou a letra "${letra}"?`);
}

// --- BOTÃO ADIVINHAR PALAVRA ---
DOM.btnAdivinhar.addEventListener('click', () => {
    DOM.inputAdivinhar.value = '';
    DOM.erroAdivinhar.textContent = '';
    DOM.modalAdivinhar.classList.add('ativo');
    setTimeout(() => DOM.inputAdivinhar.focus(), 100);
});

DOM.btnConfirmarAdivinhar.addEventListener('click', () => {
    const palpite = normalizar(DOM.inputAdivinhar.value.trim());
    if (palpite.length < 2) {
        DOM.erroAdivinhar.textContent = 'Digite a palavra completa.';
        return;
    }
    estado.palpiteAdivinhar = palpite;
    estado.modoAdivinhar = true;
    DOM.modalAdivinhar.classList.remove('ativo');

    // Abrir modal para selecionar jogador
    abrirModalJogador('Quem tentou adivinhar a palavra?');
});

DOM.btnCancelarAdivinhar.addEventListener('click', () => {
    DOM.modalAdivinhar.classList.remove('ativo');
});

DOM.inputAdivinhar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') DOM.btnConfirmarAdivinhar.click();
});

// Filtrar input adivinhar
DOM.inputAdivinhar.addEventListener('input', () => {
    let val = DOM.inputAdivinhar.value;
    val = val.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
    DOM.inputAdivinhar.value = val;
    DOM.erroAdivinhar.textContent = '';
});

// =========================================
//  MODAL: Selecionar Jogador
// =========================================

function abrirModalJogador(titulo) {
    DOM.modalTitulo.textContent = titulo;
    DOM.modalJogadores.innerHTML = '';

    estado.jogadores.forEach((j, i) => {
        if (i === estado.indiceMestre) return; // Mestre não participa

        const btn = document.createElement('button');
        btn.className = 'modal-jogador-btn';
        btn.textContent = j.nome;
        btn.addEventListener('click', () => onJogadorSelecionado(i));
        DOM.modalJogadores.appendChild(btn);
    });

    DOM.modalJogador.classList.add('ativo');
}

DOM.modalCancelar.addEventListener('click', () => {
    DOM.modalJogador.classList.remove('ativo');
    estado.letraPendente = null;
    estado.modoAdivinhar = false;
});

function onJogadorSelecionado(indiceJogador) {
    DOM.modalJogador.classList.remove('ativo');

    if (estado.modoAdivinhar) {
        processarAdivinharPalavra(indiceJogador);
    } else if (estado.letraPendente) {
        processarPalpiteLetra(estado.letraPendente, indiceJogador);
        estado.letraPendente = null;
    }
}

// =========================================
//  LÓGICA DE PALPITES
// =========================================

function processarPalpiteLetra(letra, indiceJogador) {
    estado.letrasUsadas.add(letra);
    const btnTecla = DOM.teclado.querySelector(`[data-letra="${letra}"]`);

    if (estado.palavraSecreta.includes(letra)) {
        // ACERTO
        btnTecla.classList.add('correta');
        revelarLetra(letra);
        estado.jogadores[indiceJogador].pontos += 1;
        atualizarPlacar();
        mostrarMensagemPontos(`+1`, 'positivo');

        // Animar placar do jogador
        animarPlacar(indiceJogador, 'pulse-acerto');

        // Verificar vitória
        if (verificarVitoria()) {
            setTimeout(() => fimDeRodada('letras'), 800);
        }
    } else {
        // ERRO
        btnTecla.classList.add('errada');
        estado.erros++;
        DOM.errosCount.textContent = estado.erros;
        desenharParteCorpo(estado.erros);

        // Shake no canvas
        DOM.forcaCanvas.classList.add('shake');
        setTimeout(() => DOM.forcaCanvas.classList.remove('shake'), 400);

        // Verificar derrota
        if (estado.erros >= MAX_ERROS) {
            setTimeout(() => fimDeRodada('forca'), 800);
        }
    }
}

function processarAdivinharPalavra(indiceJogador) {
    const palpite = estado.palpiteAdivinhar;

    if (palpite === estado.palavraSecreta) {
        // ACERTOU A PALAVRA
        estado.jogadores[indiceJogador].pontos += 3;
        atualizarPlacar();
        mostrarMensagemPontos('+3!', 'positivo');

        // Revelar todas as letras
        revelarTodasLetras();

        setTimeout(() => fimDeRodada('adivinhou', indiceJogador), 800);
    } else {
        // ERROU A PALAVRA
        estado.jogadores[indiceJogador].pontos -= 2;
        atualizarPlacar();
        mostrarMensagemPontos('-2', 'negativo');

        estado.erros++;
        DOM.errosCount.textContent = estado.erros;
        desenharParteCorpo(estado.erros);

        DOM.forcaCanvas.classList.add('shake');
        setTimeout(() => DOM.forcaCanvas.classList.remove('shake'), 400);

        if (estado.erros >= MAX_ERROS) {
            setTimeout(() => fimDeRodada('forca'), 800);
        }
    }

    estado.modoAdivinhar = false;
    estado.palpiteAdivinhar = '';
}

function revelarTodasLetras() {
    const chars = DOM.palavraDisplay.querySelectorAll('.letra-char');
    chars.forEach(c => c.classList.add('revelada'));
}

function animarPlacar(indice, classe) {
    const el = document.getElementById(`placar-${indice}`);
    if (el) {
        el.classList.add(classe);
        setTimeout(() => el.classList.remove(classe), 600);
    }
}

// =========================================
//  FIM DE RODADA
// =========================================

function fimDeRodada(motivo, indiceVencedor) {
    revelarTodasLetras();

    let icone, titulo, mensagem;

    if (motivo === 'forca') {
        // Mestre venceu
        estado.jogadores[estado.indiceMestre].pontos += 5;
        atualizarPlacar();

        icone = '💀';
        titulo = 'Ninguém acertou!';
        mensagem = `${estado.jogadores[estado.indiceMestre].nome} (Mestre) ganha +5 pontos!`;
    } else if (motivo === 'adivinhou') {
        icone = '🎉';
        titulo = 'Palavra Adivinhada!';
        mensagem = `${estado.jogadores[indiceVencedor].nome} acertou a palavra e ganhou +3 pontos!`;
    } else {
        // Todas as letras reveladas
        icone = '✨';
        titulo = 'Palavra Completa!';
        mensagem = 'Todas as letras foram descobertas!';
    }

    DOM.fimIcone.textContent = icone;
    DOM.fimTitulo.textContent = titulo;
    DOM.fimMensagem.textContent = mensagem;
    DOM.fimPalavra.textContent = estado.palavraSecreta;

    DOM.modalFim.classList.add('ativo');
}

DOM.btnProximaRodada.addEventListener('click', () => {
    DOM.modalFim.classList.remove('ativo');

    // Avançar mestre ciclicamente
    estado.indiceMestre = (estado.indiceMestre + 1) % estado.jogadores.length;

    iniciarRodada();
});

// =========================================
//  DESENHO DA FORCA (Canvas)
// =========================================

function getCtx() {
    return DOM.forcaCanvas.getContext('2d');
}

function desenharForcaBase() {
    const canvas = DOM.forcaCanvas;
    const ctx = getCtx();

    // Ajustar para resolução real
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Base
    ctx.beginPath();
    ctx.moveTo(20, h - 10);
    ctx.lineTo(w - 20, h - 10);
    ctx.stroke();

    // Poste vertical
    ctx.beginPath();
    ctx.moveTo(50, h - 10);
    ctx.lineTo(50, 20);
    ctx.stroke();

    // Viga horizontal
    ctx.beginPath();
    ctx.moveTo(50, 20);
    ctx.lineTo(w / 2 + 20, 20);
    ctx.stroke();

    // Corda
    ctx.beginPath();
    ctx.moveTo(w / 2 + 20, 20);
    ctx.lineTo(w / 2 + 20, 45);
    ctx.stroke();
}

function desenharParteCorpo(numErro) {
    const canvas = DOM.forcaCanvas;
    const ctx = getCtx();
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    const cx = w / 2 + 20; // Centro X (onde a corda desce)

    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    switch (numErro) {
        case 1: // Cabeça
            ctx.beginPath();
            ctx.arc(cx, 60, 15, 0, Math.PI * 2);
            ctx.stroke();
            break;

        case 2: // Corpo
            ctx.beginPath();
            ctx.moveTo(cx, 75);
            ctx.lineTo(cx, 130);
            ctx.stroke();
            break;

        case 3: // Braço esquerdo
            ctx.beginPath();
            ctx.moveTo(cx, 90);
            ctx.lineTo(cx - 25, 115);
            ctx.stroke();
            break;

        case 4: // Braço direito
            ctx.beginPath();
            ctx.moveTo(cx, 90);
            ctx.lineTo(cx + 25, 115);
            ctx.stroke();
            break;

        case 5: // Perna esquerda
            ctx.beginPath();
            ctx.moveTo(cx, 130);
            ctx.lineTo(cx - 20, 165);
            ctx.stroke();
            break;

        case 6: // Perna direita
            ctx.beginPath();
            ctx.moveTo(cx, 130);
            ctx.lineTo(cx + 20, 165);
            ctx.stroke();
            break;
    }
}
