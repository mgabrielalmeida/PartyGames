/* =========================================
   BLACKJACK — Lógica Principal
   ========================================= */

// --- CONSTANTES ---
const NAIPES = ['♠', '♣', '♥', '♦'];
const NAIPES_COR = { '♠': 'preta', '♣': 'preta', '♥': 'vermelha', '♦': 'vermelha' };
const VALORES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const VALOR_PONTOS = {
    'A': 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, 'T': 10, 'J': 10, 'Q': 10, 'K': 10
};
const FICHAS_OPCOES = [100, 200, 500, 1000, 2000];
const APOSTA_STEP = 50;
const APOSTA_MIN = 10;

// --- ESTADO DO JOGO ---
const estado = {
    jogadores: [],           // { nome, fichas, maos: [{ cartas, aposta, encerrada, resultado }], maoAtualIdx }
    dealer: { cartas: [] },
    baralho: [],
    jogadorAtualIdx: 0,
    faseJogo: 'setup',       // 'setup' | 'apostas' | 'jogando' | 'dealer' | 'resultado'
};

// --- REFERÊNCIAS AO DOM ---
const DOM = {
    // Telas
    telaSetup: document.getElementById('tela-setup'),
    telaApostas: document.getElementById('tela-apostas'),
    telaJogo: document.getElementById('tela-jogo'),

    // Setup
    numJogadores: document.getElementById('num-jogadores'),
    btnMinus: document.getElementById('btn-minus'),
    btnPlus: document.getElementById('btn-plus'),
    numFichas: document.getElementById('num-fichas'),
    btnFichasMinus: document.getElementById('btn-fichas-minus'),
    btnFichasPlus: document.getElementById('btn-fichas-plus'),
    btnIniciar: document.getElementById('btn-iniciar'),

    // Apostas
    apostasJogadores: document.getElementById('apostas-jogadores'),
    btnConfirmarApostas: document.getElementById('btn-confirmar-apostas'),

    // Jogo
    dealerCartas: document.getElementById('dealer-cartas'),
    dealerPontos: document.getElementById('dealer-pontos'),
    statusTexto: document.getElementById('status-texto'),
    jogadoresArea: document.getElementById('jogadores-area'),
    acoesContainer: document.getElementById('acoes-container'),

    // Botões de ação
    btnHit: document.getElementById('btn-hit'),
    btnStand: document.getElementById('btn-stand'),
    btnDouble: document.getElementById('btn-double'),
    btnSplit: document.getElementById('btn-split'),

    // Modais
    modalResultado: document.getElementById('modal-resultado'),
    resultadoLista: document.getElementById('resultado-lista'),
    btnProximaRodada: document.getElementById('btn-proxima-rodada'),

    modalFim: document.getElementById('modal-fim'),
    fimIcone: document.getElementById('fim-icone'),
    fimTitulo: document.getElementById('fim-titulo'),
    fimMensagem: document.getElementById('fim-mensagem'),
    btnNovoJogo: document.getElementById('btn-novo-jogo'),

    // Mensagem flutuante
    mensagemFlutuante: document.getElementById('mensagem-flutuante'),
};

// --- UTILITÁRIOS ---
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

function mostrarMensagem(texto, tipo) {
    const el = DOM.mensagemFlutuante;
    el.textContent = texto;
    el.className = 'mensagem-pontos mostrar ' + tipo;

    setTimeout(() => {
        el.classList.remove('mostrar');
    }, 1200);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =========================================
//  BARALHO
// =========================================

function criarBaralho(numDecks = 6) {
    const baralho = [];
    for (let d = 0; d < numDecks; d++) {
        for (const naipe of NAIPES) {
            for (const valor of VALORES) {
                baralho.push({ naipe, valor });
            }
        }
    }
    // Embaralhar (Fisher-Yates)
    for (let i = baralho.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [baralho[i], baralho[j]] = [baralho[j], baralho[i]];
    }
    return baralho;
}

function comprarCarta() {
    if (estado.baralho.length < 20) {
        // Re-embaralhar quando ficarmo poucas cartas
        estado.baralho = criarBaralho();
    }
    return estado.baralho.pop();
}

function calcularPontos(cartas) {
    let pontos = 0;
    let ases = 0;

    for (const carta of cartas) {
        pontos += VALOR_PONTOS[carta.valor];
        if (carta.valor === 'A') ases++;
    }

    // Converter ases de 11 para 1 conforme necessário
    while (pontos > 21 && ases > 0) {
        pontos -= 10;
        ases--;
    }

    return pontos;
}

function ehBlackjack(cartas) {
    return cartas.length === 2 && calcularPontos(cartas) === 21;
}

function ehBlackjackMesmoNaipe(cartas) {
    return ehBlackjack(cartas) && cartas[0].naipe === cartas[1].naipe;
}

// =========================================
//  RENDERIZAÇÃO DE CARTAS
// =========================================

function renderizarCarta(carta, oculta = false) {
    if (oculta) {
        return `<div class="carta carta-verso"></div>`;
    }
    const cor = NAIPES_COR[carta.naipe];
    return `
        <div class="carta carta-frente ${cor}">
            <span class="carta-naipe">${carta.naipe}</span>
            <span class="carta-valor">${carta.valor}</span>
        </div>
    `;
}

function renderizarDealer(revelar = false) {
    const cartas = estado.dealer.cartas;
    let html = '';

    cartas.forEach((carta, i) => {
        if (i === 1 && !revelar) {
            html += renderizarCarta(carta, true);
        } else {
            html += renderizarCarta(carta);
        }
    });

    DOM.dealerCartas.innerHTML = html;

    // Pontos
    if (revelar) {
        const pts = calcularPontos(cartas);
        if (pts > 21) {
            DOM.dealerPontos.textContent = `${pts} — BUST!`;
            DOM.dealerPontos.className = 'pontos-badge bust';
        } else if (ehBlackjack(cartas)) {
            DOM.dealerPontos.textContent = `${pts} — BLACKJACK!`;
            DOM.dealerPontos.className = 'pontos-badge blackjack';
        } else {
            DOM.dealerPontos.textContent = pts;
            DOM.dealerPontos.className = 'pontos-badge';
        }
    } else {
        // Mostra apenas a carta visível
        const cartaVisivel = cartas[0];
        DOM.dealerPontos.textContent = VALOR_PONTOS[cartaVisivel.valor];
        DOM.dealerPontos.className = 'pontos-badge';
    }
}

function renderizarJogadores() {
    DOM.jogadoresArea.innerHTML = '';

    estado.jogadores.forEach((jogador, jIdx) => {
        const panel = document.createElement('div');
        panel.className = 'jogador-panel';
        panel.id = `jogador-panel-${jIdx}`;

        if (jIdx === estado.jogadorAtualIdx && estado.faseJogo === 'jogando') {
            panel.classList.add('ativo');
        }

        let cartasHTML = '';

        if (jogador.maos.length === 1) {
            // Mão única
            const mao = jogador.maos[0];
            const pts = calcularPontos(mao.cartas);
            cartasHTML = `
                <div class="jogador-aposta-info">Aposta: <span class="aposta-val">${mao.aposta}</span></div>
                <div class="jogador-cartas">
                    ${mao.cartas.map(c => renderizarCarta(c)).join('')}
                </div>
                <div class="jogador-pontos">${formatarPontos(mao, pts)}</div>
            `;
        } else {
            // Split — múltiplas mãos
            cartasHTML = `<div class="mao-split-container">`;
            jogador.maos.forEach((mao, mIdx) => {
                const pts = calcularPontos(mao.cartas);
                const ativa = jIdx === estado.jogadorAtualIdx && mIdx === jogador.maoAtualIdx && estado.faseJogo === 'jogando';
                cartasHTML += `
                    <div class="mao-split ${ativa ? 'mao-ativa' : ''}">
                        <span class="mao-split-label">Mão ${mIdx + 1}</span>
                        <div class="jogador-aposta-info">Aposta: <span class="aposta-val">${mao.aposta}</span></div>
                        <div class="jogador-cartas">
                            ${mao.cartas.map(c => renderizarCarta(c)).join('')}
                        </div>
                        <div class="jogador-pontos">${formatarPontos(mao, pts)}</div>
                    </div>
                `;
            });
            cartasHTML += `</div>`;
        }

        panel.innerHTML = `
            <div class="jogador-header">
                <span class="jogador-nome">${jogador.nome}</span>
                <span class="jogador-fichas">🪙 ${jogador.fichas}</span>
            </div>
            ${cartasHTML}
        `;

        DOM.jogadoresArea.appendChild(panel);
    });
}

function formatarPontos(mao, pts) {
    if (mao.cartas.length === 0) return '—';
    if (pts > 21) return `<span style="color:#ff4757">${pts} — BUST!</span>`;
    if (ehBlackjack(mao.cartas)) return `<span style="color:#ffd700">✨ ${pts} — BLACKJACK!</span>`;
    return pts;
}

// =========================================
//  TELA 1: SETUP
// =========================================

let numJogadoresVal = 1;
let fichasIniciaisVal = 500;

DOM.btnMinus.addEventListener('click', () => {
    if (numJogadoresVal > 1) {
        numJogadoresVal--;
        DOM.numJogadores.textContent = numJogadoresVal;
    }
});

DOM.btnPlus.addEventListener('click', () => {
    if (numJogadoresVal < 4) {
        numJogadoresVal++;
        DOM.numJogadores.textContent = numJogadoresVal;
    }
});

DOM.btnFichasMinus.addEventListener('click', () => {
    const idx = FICHAS_OPCOES.indexOf(fichasIniciaisVal);
    if (idx > 0) {
        fichasIniciaisVal = FICHAS_OPCOES[idx - 1];
        DOM.numFichas.textContent = fichasIniciaisVal;
    }
});

DOM.btnFichasPlus.addEventListener('click', () => {
    const idx = FICHAS_OPCOES.indexOf(fichasIniciaisVal);
    if (idx < FICHAS_OPCOES.length - 1) {
        fichasIniciaisVal = FICHAS_OPCOES[idx + 1];
        DOM.numFichas.textContent = fichasIniciaisVal;
    }
});

DOM.btnIniciar.addEventListener('click', () => {
    // Inicializar jogadores
    estado.jogadores = [];
    for (let i = 0; i < numJogadoresVal; i++) {
        estado.jogadores.push({
            nome: `Jogador ${i + 1}`,
            fichas: fichasIniciaisVal,
            maos: [],
            maoAtualIdx: 0,
        });
    }

    estado.baralho = criarBaralho();
    iniciarRodadaApostas();
});

// =========================================
//  TELA 2: APOSTAS
// =========================================

let apostasTemp = []; // apostas temporárias para cada jogador

function iniciarRodadaApostas() {
    estado.faseJogo = 'apostas';

    // Filtrar jogadores com fichas suficientes
    const jogadoresAtivos = estado.jogadores.filter(j => j.fichas >= APOSTA_MIN);

    if (jogadoresAtivos.length === 0) {
        // Todos estão sem fichas — fim de jogo
        mostrarFimDeJogo();
        return;
    }

    apostasTemp = estado.jogadores.map(j => {
        if (j.fichas >= APOSTA_MIN) {
            return Math.min(APOSTA_MIN, j.fichas);
        }
        return 0; // Sem fichas suficientes
    });

    renderizarApostas();
    mostrarTela(DOM.telaApostas);
}

function renderizarApostas() {
    DOM.apostasJogadores.innerHTML = '';

    estado.jogadores.forEach((jogador, i) => {
        if (jogador.fichas < APOSTA_MIN) return; // Pular jogadores sem fichas

        const card = document.createElement('div');
        card.className = 'aposta-card';
        card.innerHTML = `
            <div class="aposta-card-info">
                <div class="aposta-card-nome">${jogador.nome}</div>
                <div class="aposta-card-fichas">🪙 ${jogador.fichas} fichas</div>
            </div>
            <div class="aposta-input-group">
                <button class="btn-stepper" data-jogador="${i}" data-dir="minus">−</button>
                <span class="aposta-valor" id="aposta-val-${i}">${apostasTemp[i]}</span>
                <button class="btn-stepper" data-jogador="${i}" data-dir="plus">+</button>
            </div>
        `;
        DOM.apostasJogadores.appendChild(card);
    });

    // Event listeners para botões de aposta
    DOM.apostasJogadores.querySelectorAll('.btn-stepper').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.jogador);
            const dir = e.target.dataset.dir;
            const jogador = estado.jogadores[idx];

            if (dir === 'plus') {
                apostasTemp[idx] = Math.min(apostasTemp[idx] + APOSTA_STEP, jogador.fichas);
            } else {
                apostasTemp[idx] = Math.max(apostasTemp[idx] - APOSTA_STEP, APOSTA_MIN);
            }

            document.getElementById(`aposta-val-${idx}`).textContent = apostasTemp[idx];
        });
    });
}

DOM.btnConfirmarApostas.addEventListener('click', () => {
    // Validar apostas
    let valido = true;
    estado.jogadores.forEach((jogador, i) => {
        if (jogador.fichas >= APOSTA_MIN && apostasTemp[i] < APOSTA_MIN) {
            valido = false;
        }
    });

    if (valido) {
        iniciarRodada();
    }
});

// =========================================
//  RODADA DE JOGO
// =========================================

function iniciarRodada() {
    estado.faseJogo = 'jogando';

    // Configurar mãos dos jogadores
    estado.jogadores.forEach((jogador, i) => {
        if (jogador.fichas >= APOSTA_MIN) {
            jogador.maos = [{
                cartas: [],
                aposta: apostasTemp[i],
                encerrada: false,
                resultado: null,
            }];
            jogador.fichas -= apostasTemp[i];
        } else {
            jogador.maos = [{
                cartas: [],
                aposta: 0,
                encerrada: true,
                resultado: 'sem_fichas',
            }];
        }
        jogador.maoAtualIdx = 0;
    });

    // Configurar dealer
    estado.dealer.cartas = [];

    // Distribuir cartas: 2 para cada jogador, 2 para o dealer
    estado.jogadores.forEach(jogador => {
        if (jogador.maos[0].aposta > 0) {
            jogador.maos[0].cartas.push(comprarCarta());
            jogador.maos[0].cartas.push(comprarCarta());
        }
    });
    estado.dealer.cartas.push(comprarCarta());
    estado.dealer.cartas.push(comprarCarta());

    // Encontrar primeiro jogador ativo
    estado.jogadorAtualIdx = encontrarProximoJogadorAtivo(-1);

    mostrarTela(DOM.telaJogo);

    setTimeout(() => {
        renderizarDealer(false);
        renderizarJogadores();
        atualizarAcoes();
        atualizarStatus();
    }, 500);
}

function encontrarProximoJogadorAtivo(desdeIdx) {
    for (let i = desdeIdx + 1; i < estado.jogadores.length; i++) {
        const jogador = estado.jogadores[i];
        // Um jogador está ativo se tem pelo menos uma mão não encerrada
        const temMaoAtiva = jogador.maos.some(m => !m.encerrada && m.aposta > 0);
        if (temMaoAtiva) return i;
    }
    return -1; // Nenhum jogador ativo encontrado
}

function atualizarStatus() {
    if (estado.faseJogo === 'jogando') {
        const jogador = estado.jogadores[estado.jogadorAtualIdx];
        if (jogador) {
            if (jogador.maos.length > 1) {
                DOM.statusTexto.textContent = `${jogador.nome} — Mão ${jogador.maoAtualIdx + 1}`;
            } else {
                DOM.statusTexto.textContent = `Vez de ${jogador.nome}`;
            }
        }
    } else if (estado.faseJogo === 'dealer') {
        DOM.statusTexto.textContent = 'Vez do Dealer';
    }
}

function atualizarAcoes() {
    if (estado.faseJogo !== 'jogando' || estado.jogadorAtualIdx < 0) {
        DOM.acoesContainer.style.display = 'none';
        return;
    }

    DOM.acoesContainer.style.display = 'flex';

    const jogador = estado.jogadores[estado.jogadorAtualIdx];
    const mao = jogador.maos[jogador.maoAtualIdx];

    if (!mao || mao.encerrada) {
        DOM.acoesContainer.style.display = 'none';
        return;
    }

    const pts = calcularPontos(mao.cartas);

    // Verificar bust automático
    if (pts > 21) {
        mao.encerrada = true;
        mao.resultado = 'bust';
        mostrarMensagem('BUST! 💥', 'negativo');
        renderizarJogadores();
        setTimeout(() => avancarJogada(), 800);
        return;
    }

    // Verificar blackjack natural (apenas na distribuição inicial, sem split)
    if (ehBlackjack(mao.cartas) && jogador.maos.length === 1) {
        mao.encerrada = true;
        mostrarMensagem('BLACKJACK! ✨', 'ouro');
        renderizarJogadores();
        setTimeout(() => avancarJogada(), 800);
        return;
    }

    // Habilitar/desabilitar botões
    DOM.btnHit.disabled = false;
    DOM.btnStand.disabled = false;

    // Double: apenas com 2 cartas e fichas suficientes
    DOM.btnDouble.disabled = !(mao.cartas.length === 2 && jogador.fichas >= mao.aposta);

    // Split: apenas com 2 cartas de mesmo valor e fichas suficientes
    const podeSplit = mao.cartas.length === 2
        && VALOR_PONTOS[mao.cartas[0].valor] === VALOR_PONTOS[mao.cartas[1].valor]
        && jogador.fichas >= mao.aposta
        && jogador.maos.length === 1; // Só permite 1 split
    DOM.btnSplit.disabled = !podeSplit;
}

// =========================================
//  AÇÕES DOS JOGADORES
// =========================================

DOM.btnHit.addEventListener('click', () => {
    if (estado.faseJogo !== 'jogando') return;
    acaoHit();
});

DOM.btnStand.addEventListener('click', () => {
    if (estado.faseJogo !== 'jogando') return;
    acaoStand();
});

DOM.btnDouble.addEventListener('click', () => {
    if (estado.faseJogo !== 'jogando') return;
    acaoDouble();
});

DOM.btnSplit.addEventListener('click', () => {
    if (estado.faseJogo !== 'jogando') return;
    acaoSplit();
});

function acaoHit() {
    const jogador = estado.jogadores[estado.jogadorAtualIdx];
    const mao = jogador.maos[jogador.maoAtualIdx];

    mao.cartas.push(comprarCarta());
    renderizarJogadores();

    const pts = calcularPontos(mao.cartas);
    if (pts > 21) {
        mao.encerrada = true;
        mao.resultado = 'bust';
        mostrarMensagem('BUST! 💥', 'negativo');
        renderizarJogadores();
        setTimeout(() => avancarJogada(), 800);
    } else if (pts === 21) {
        // Automaticamente stand em 21
        mao.encerrada = true;
        renderizarJogadores();
        setTimeout(() => avancarJogada(), 600);
    } else {
        atualizarAcoes();
    }
}

function acaoStand() {
    const jogador = estado.jogadores[estado.jogadorAtualIdx];
    const mao = jogador.maos[jogador.maoAtualIdx];

    mao.encerrada = true;
    renderizarJogadores();
    avancarJogada();
}

function acaoDouble() {
    const jogador = estado.jogadores[estado.jogadorAtualIdx];
    const mao = jogador.maos[jogador.maoAtualIdx];

    // Dobrar a aposta
    jogador.fichas -= mao.aposta;
    mao.aposta *= 2;

    // Receber apenas mais uma carta
    mao.cartas.push(comprarCarta());
    mao.encerrada = true;

    const pts = calcularPontos(mao.cartas);
    if (pts > 21) {
        mao.resultado = 'bust';
        mostrarMensagem('BUST! 💥', 'negativo');
    } else {
        mostrarMensagem('DOUBLE! 💰', 'ouro');
    }

    renderizarJogadores();
    setTimeout(() => avancarJogada(), 800);
}

function acaoSplit() {
    const jogador = estado.jogadores[estado.jogadorAtualIdx];
    const maoOriginal = jogador.maos[0];
    const apostaOriginal = maoOriginal.aposta;

    // Deduzir aposta da segunda mão
    jogador.fichas -= apostaOriginal;

    // Separar as cartas
    const carta1 = maoOriginal.cartas[0];
    const carta2 = maoOriginal.cartas[1];

    // Criar duas mãos
    jogador.maos = [
        {
            cartas: [carta1, comprarCarta()],
            aposta: apostaOriginal,
            encerrada: false,
            resultado: null,
        },
        {
            cartas: [carta2, comprarCarta()],
            aposta: apostaOriginal,
            encerrada: false,
            resultado: null,
        }
    ];

    jogador.maoAtualIdx = 0;

    mostrarMensagem('SPLIT! ✂️', 'ouro');
    renderizarJogadores();
    atualizarStatus();

    // Verificar se a primeira mão já tem 21
    setTimeout(() => atualizarAcoes(), 600);
}

// =========================================
//  FLUXO DO JOGO
// =========================================

function avancarJogada() {
    const jogador = estado.jogadores[estado.jogadorAtualIdx];

    // Verificar se há mais mãos neste jogador (split)
    if (jogador.maoAtualIdx < jogador.maos.length - 1) {
        // Avançar para a próxima mão
        jogador.maoAtualIdx++;
        renderizarJogadores();
        atualizarStatus();
        atualizarAcoes();
        return;
    }

    // Avançar para o próximo jogador
    const proximo = encontrarProximoJogadorAtivo(estado.jogadorAtualIdx);

    if (proximo >= 0) {
        estado.jogadorAtualIdx = proximo;
        renderizarJogadores();
        atualizarStatus();
        atualizarAcoes();
    } else {
        // Todos os jogadores jogaram — vez do dealer
        iniciarTurnoDealer();
    }
}

async function iniciarTurnoDealer() {
    estado.faseJogo = 'dealer';
    DOM.acoesContainer.style.display = 'none';
    atualizarStatus();

    // Verificar se todos deram bust
    const todosBust = estado.jogadores.every(j =>
        j.maos.every(m => m.resultado === 'bust' || m.aposta === 0)
    );

    // Revelar carta do dealer
    renderizarDealer(true);
    await delay(800);

    if (!todosBust) {
        // Dealer compra cartas até >= 17
        while (calcularPontos(estado.dealer.cartas) < 17) {
            estado.dealer.cartas.push(comprarCarta());
            renderizarDealer(true);
            await delay(600);
        }
    }

    // Calcular resultados
    await delay(400);
    calcularResultados();
}

// =========================================
//  RESULTADOS
// =========================================

function calcularResultados() {
    const dealerPts = calcularPontos(estado.dealer.cartas);
    const dealerBust = dealerPts > 21;
    const dealerBlackjack = ehBlackjack(estado.dealer.cartas);

    estado.jogadores.forEach(jogador => {
        jogador.maos.forEach(mao => {
            if (mao.aposta === 0 || mao.resultado === 'bust') {
                // Já resolvido
                if (mao.resultado !== 'bust') mao.resultado = 'sem_fichas';
                return;
            }

            const pts = calcularPontos(mao.cartas);
            const jogadorBlackjack = ehBlackjack(mao.cartas);

            if (jogadorBlackjack && !dealerBlackjack) {
                // Blackjack do jogador
                if (ehBlackjackMesmoNaipe(mao.cartas)) {
                    mao.resultado = 'blackjack_suited';
                } else {
                    mao.resultado = 'blackjack';
                }
            } else if (jogadorBlackjack && dealerBlackjack) {
                mao.resultado = 'push';
            } else if (dealerBlackjack) {
                mao.resultado = 'derrota';
            } else if (dealerBust) {
                mao.resultado = 'vitoria';
            } else if (pts > dealerPts) {
                mao.resultado = 'vitoria';
            } else if (pts === dealerPts) {
                mao.resultado = 'push';
            } else {
                mao.resultado = 'derrota';
            }
        });
    });

    // Aplicar pagamentos
    estado.jogadores.forEach(jogador => {
        jogador.maos.forEach(mao => {
            switch (mao.resultado) {
                case 'blackjack_suited':
                    jogador.fichas += mao.aposta * 3; // 2:1 + aposta original
                    break;
                case 'blackjack':
                    jogador.fichas += Math.floor(mao.aposta * 2.5); // 3:2 + aposta original
                    break;
                case 'vitoria':
                    jogador.fichas += mao.aposta * 2; // 1:1 + aposta original
                    break;
                case 'push':
                    jogador.fichas += mao.aposta; // devolver aposta
                    break;
                // bust e derrota: já perdeu a aposta (fichas já descontadas)
            }
        });
    });

    renderizarJogadores();
    mostrarResultadoRodada();
}

function mostrarResultadoRodada() {
    DOM.resultadoLista.innerHTML = '';

    estado.jogadores.forEach(jogador => {
        jogador.maos.forEach((mao, mIdx) => {
            if (mao.resultado === 'sem_fichas') return;

            const item = document.createElement('div');
            let className = 'resultado-item';
            let statusTexto = '';
            let statusClass = '';
            let fichasTexto = '';
            let fichasClass = '';

            const nomeLabel = jogador.maos.length > 1
                ? `${jogador.nome} (Mão ${mIdx + 1})`
                : jogador.nome;

            switch (mao.resultado) {
                case 'blackjack_suited':
                    className += ' vitoria';
                    statusTexto = '✨ BLACKJACK SUITED!';
                    statusClass = 'win';
                    fichasTexto = `+${mao.aposta * 2}`;
                    fichasClass = 'positivo';
                    break;
                case 'blackjack':
                    className += ' vitoria';
                    statusTexto = '✨ BLACKJACK!';
                    statusClass = 'win';
                    fichasTexto = `+${Math.floor(mao.aposta * 1.5)}`;
                    fichasClass = 'positivo';
                    break;
                case 'vitoria':
                    className += ' vitoria';
                    statusTexto = '✅ Vitória';
                    statusClass = 'win';
                    fichasTexto = `+${mao.aposta}`;
                    fichasClass = 'positivo';
                    break;
                case 'push':
                    className += ' empate';
                    statusTexto = '🤝 Push';
                    statusClass = 'push';
                    fichasTexto = '±0';
                    fichasClass = '';
                    break;
                case 'bust':
                    className += ' derrota';
                    statusTexto = '💥 Bust';
                    statusClass = 'lose';
                    fichasTexto = `-${mao.aposta}`;
                    fichasClass = 'negativo';
                    break;
                case 'derrota':
                    className += ' derrota';
                    statusTexto = '❌ Derrota';
                    statusClass = 'lose';
                    fichasTexto = `-${mao.aposta}`;
                    fichasClass = 'negativo';
                    break;
            }

            item.className = className;
            item.innerHTML = `
                <span class="resultado-nome">${nomeLabel}</span>
                <div class="resultado-detalhe">
                    <span class="resultado-status ${statusClass}">${statusTexto}</span>
                    <span class="resultado-fichas ${fichasClass}">${fichasTexto} fichas</span>
                </div>
            `;
            DOM.resultadoLista.appendChild(item);
        });
    });

    // Verificar se algum jogador ficou sem fichas
    const jogadoresSemFichas = estado.jogadores.filter(j => j.fichas < APOSTA_MIN);
    if (jogadoresSemFichas.length > 0) {
        const aviso = document.createElement('div');
        aviso.style.cssText = 'color: var(--text-muted); font-size: 0.8rem; margin-top: 8px;';
        aviso.textContent = `⚠️ ${jogadoresSemFichas.map(j => j.nome).join(', ')} ficou(aram) sem fichas suficientes.`;
        DOM.resultadoLista.appendChild(aviso);
    }

    // Verificar se todos ficaram sem fichas
    const todosZerados = estado.jogadores.every(j => j.fichas < APOSTA_MIN);
    if (todosZerados) {
        DOM.btnProximaRodada.textContent = 'Ver Resultado Final';
        DOM.btnProximaRodada.onclick = () => {
            DOM.modalResultado.classList.remove('ativo');
            mostrarFimDeJogo();
        };
    } else {
        DOM.btnProximaRodada.textContent = 'Próxima Rodada';
        DOM.btnProximaRodada.onclick = () => {
            DOM.modalResultado.classList.remove('ativo');
            iniciarRodadaApostas();
        };
    }

    DOM.modalResultado.classList.add('ativo');
}

// =========================================
//  FIM DE JOGO
// =========================================

function mostrarFimDeJogo() {
    // Determinar vencedor (mais fichas)
    const melhor = [...estado.jogadores].sort((a, b) => b.fichas - a.fichas)[0];

    if (estado.jogadores.length === 1) {
        DOM.fimIcone.textContent = melhor.fichas > 0 ? '🏆' : '💸';
        DOM.fimTitulo.textContent = melhor.fichas > 0 ? 'Fim de Jogo!' : 'Sem fichas!';
        DOM.fimMensagem.textContent = `${melhor.nome} terminou com ${melhor.fichas} fichas.`;
    } else {
        DOM.fimIcone.textContent = '🏆';
        DOM.fimTitulo.textContent = `${melhor.nome} Venceu!`;

        let ranking = estado.jogadores
            .map(j => `${j.nome}: 🪙 ${j.fichas}`)
            .join('\n');
        DOM.fimMensagem.textContent = ranking;
        DOM.fimMensagem.style.whiteSpace = 'pre-line';
    }

    DOM.modalFim.classList.add('ativo');
}

DOM.btnNovoJogo.addEventListener('click', () => {
    DOM.modalFim.classList.remove('ativo');
    mostrarTela(DOM.telaSetup);
});
