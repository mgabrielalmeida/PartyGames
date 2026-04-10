// Agarrando todos os elementos
const btnGirar = document.querySelector('#btn-girar');
const btnRevelar = document.querySelector('#btn-revelar');
const alvo = document.querySelector('.alvo');
const tampaSuperior = document.querySelector('#tampa-revelar');
const roda = document.querySelector('.roda');
const ponteiro = document.querySelector('.ponteiro');
const btnPalpite = document.querySelector('#btn-palpite');
const divMensagem = document.querySelector('#mensagem-resultado');

// Elementos do placar
const placarJ1 = document.querySelector('#placar-j1');
const placarJ2 = document.querySelector('#placar-j2');
const textoPontosJ1 = document.querySelector('#pontos-j1');
const textoPontosJ2 = document.querySelector('#pontos-j2');

// Elementos das Dicas
const dicaRodada = document.querySelector('#dica-rodada');
const extremoEsq = document.querySelector('#extremo-esq');
const extremoDir = document.querySelector('#extremo-dir');
const toggleSugestao = document.querySelector('#toggle-sugestao');

const listaPares = [
    ["Quente", "Frio"], ["Atraente", "Feio"], ["Fácil", "Difícil"],
    ["Cheiro Bom", "Cheiro Ruim"], ["Saudável", "Junk Food"],
    ["Obra-Prima", "Lixo"], ["Popular", "Nicho"], ["Superestimado", "Subestimado"],
    ["Caro", "Barato"], ["Relaxante", "Estressante"], ["Útil", "Inútil"],
    ["Maduro", "Infantil"], ["Normal", "Estranho"], ["Divertido", "Chato"], ["Herói", "Vilão"],
    ["Seco", "Molhado"], ["Macio", "Áspero"], ["Doce", "Salgado"], ["Famoso", "Desconhecido"],
    ["Duro", "Mole"], ["Longo", "Curto"], ["Fino", "Grosso"], ["Pessoa legal", "Pessoa chata"],
    ["Gostoso", "Nojento"], ["Situação constrangedora", "Situação comum"]
];

function atualizarSugestao() {
    if (toggleSugestao.checked) {
        const par = listaPares[Math.floor(Math.random() * listaPares.length)];
        const inverte = Math.random() > 0.5;
        const textoEsq = inverte ? par[1] : par[0];
        const textoDir = inverte ? par[0] : par[1];

        // Se quiser variar livremente sem inverter o logico:
        dicaRodada.innerHTML = `Rodada atual: <span class="destaque">${textoEsq} - ${textoDir}</span>`;
        extremoEsq.textContent = textoEsq;
        extremoDir.textContent = textoDir;

        extremoEsq.classList.remove('oculto');
        extremoDir.classList.remove('oculto');

        // Efeito visual
        dicaRodada.classList.remove('dica-animada');
        void dicaRodada.offsetWidth;
        dicaRodada.classList.add('dica-animada');
    } else {
        dicaRodada.innerHTML = "&nbsp;"; // Mantém a altura da barra mas não mostra texto
        extremoEsq.classList.add('oculto');
        extremoDir.classList.add('oculto');
    }
}

// Inicializa no carregamento
atualizarSugestao();
toggleSugestao.addEventListener('change', atualizarSugestao);

// Variáveis de memória
let rotacaoAtualAlvo = 0;
const tempoDeGiroAlvo = 2000;

// Variáveis de jogo e turnos
let jogadorAtual = 1;
let pontosJ1 = 0;
let pontosJ2 = 0;

// Variáveis para o controle do ponteiro
let estaArrastando = false;
let centroDaRoda = { x: 0, y: 0 };
let rotacaoAtualPonteiro = 0;

// --- AÇÃO 1: GIRAR A ROLETA E NOVA RODADA ---
btnGirar.addEventListener('click', function () {
    roda.classList.add('girando');

    // Sorteia nova dica se a roleta girar
    atualizarSugestao();

    const novoDestino = Math.floor(Math.random() * 181);
    const anguloAtual = rotacaoAtualAlvo % 360;
    let grausParaGirar = novoDestino - anguloAtual;
    if (grausParaGirar < 0) grausParaGirar += 360;
    const voltasExtras = (Math.floor(Math.random() * 3) + 1) * 360;
    rotacaoAtualAlvo = rotacaoAtualAlvo + grausParaGirar + voltasExtras;
    alvo.style.transform = `rotate(${rotacaoAtualAlvo}deg)`;

    setTimeout(function () {
        roda.classList.remove('girando');
    }, tempoDeGiroAlvo);
});

// --- AÇÃO 2: REVELAR/ESCONDER A TAMPA (Existente) ---
btnRevelar.addEventListener('click', function () {
    tampaSuperior.classList.toggle('escondida');
});

// --- AÇÃO 3: DAR O PALPITE E CALCULAR PONTOS ---
btnPalpite.addEventListener('click', function () {
    // Revela a tampa automaticamente
    tampaSuperior.classList.add('escondida');

    // O ponteiro sempre fica restrito ao topo (-180 a 0), então sua visualização tem + 90 (-90 a 90)
    let R_p = rotacaoAtualPonteiro + 90;
    let R_t = rotacaoAtualAlvo % 360;

    // O centro do alvo verde unrotated é em 270 deg (ou -90 deg visual)
    let centerTarget = (-90 + R_t) % 360;
    if (centerTarget > 180) centerTarget -= 360;
    if (centerTarget <= -180) centerTarget += 360;

    // Normaliza ponteiro para -180 a 180
    let pointerA = R_p % 360;
    if (pointerA > 180) pointerA -= 360;
    if (pointerA <= -180) pointerA += 360;

    // Diferença angular
    let diff = pointerA - centerTarget;
    while (diff > 180) diff -= 360;
    while (diff <= -180) diff += 360;
    let dist = Math.abs(diff);

    // Calcula os pontos baseando na distância para o centro (1.5% = 5.4 graus por cor)
    let points = 0;
    if (dist <= 2.7) {
        points = 3;
    } else if (dist <= 8.1) {
        points = 2;
    } else if (dist <= 13.5) {
        points = 1;
    } else {
        points = 0;
    }

    // Aplica os pontos ao jogador atual
    if (jogadorAtual === 1) {
        pontosJ1 += points;
        textoPontosJ1.textContent = `${pontosJ1} pts`;
    } else {
        pontosJ2 += points;
        textoPontosJ2.textContent = `${pontosJ2} pts`;
    }

    // Reinicia animações e classes
    divMensagem.classList.remove('mostrar', 'cor-3-pontos', 'cor-2-pontos', 'cor-1-ponto', 'cor-0-pontos');
    void divMensagem.offsetWidth; // Força reflow (reinicio do css transitions/animations)

    if (points === 3) {
        divMensagem.textContent = "+3!";
        divMensagem.classList.add('cor-3-pontos');
    } else if (points === 2) {
        divMensagem.textContent = "+2!";
        divMensagem.classList.add('cor-2-pontos');
    } else if (points === 1) {
        divMensagem.textContent = "+1!";
        divMensagem.classList.add('cor-1-ponto');
    } else {
        divMensagem.textContent = "Errou!";
        divMensagem.classList.add('cor-0-pontos');
    }

    divMensagem.classList.add('mostrar');

    // Troca o turno após o palpite (com um pequeno delay visual com setTimeout)
    setTimeout(() => {
        jogadorAtual = jogadorAtual === 1 ? 2 : 1;

        if (jogadorAtual === 1) {
            placarJ1.classList.add('ativo');
            placarJ2.classList.remove('ativo');
        } else {
            placarJ2.classList.add('ativo');
            placarJ1.classList.remove('ativo');
        }
    }, 1500); // Muda o jogador após um curto delay para não ser abrupto o visual
});

// ==========================================================
// --- LÓGICA ATUALIZADA: PONTEIRO ARRASTÁVEL E LIMITADO ---
// ==========================================================

// Função auxiliar para calcular o centro da roda
function calcularCentro() {
    const rect = roda.getBoundingClientRect();
    centroDaRoda.x = rect.left + rect.width / 2;
    centroDaRoda.y = rect.top + rect.height / 2;
}

// 1. COMEÇAR A ARRASTAR (mousedown no ponteiro)
ponteiro.addEventListener('mousedown', function (event) {
    estaArrastando = true;
    calcularCentro();
    event.preventDefault();
});

// 2. MOVER O MOUSE (mousemove na janela inteira, para não "perder" o ponteiro)
window.addEventListener('mousemove', function (event) {
    if (estaArrastando) {

        // --- A MATEMÁTICA DO ÂNGULO ---
        const dX = event.clientX - centroDaRoda.x;
        const dY = event.clientY - centroDaRoda.y;

        // Calcula o ângulo em radianos e converte para graus
        // O resultado é entre -180 (esquerda) e 180 (esquerda, por baixo)
        let angulo = Math.atan2(dY, dX) * (180 / Math.PI);

        // ==========================================================
        // --- CORREÇÃO: Restrição para o topo do círculo ---
        // ==========================================================

        // Em geometria, a metade de baixo do círculo tem ângulos POSITIVOS (0 a 180)
        // Se o ângulo for maior que 0, o mouse está na metade inferior.
        if (angulo > 0) {

            // Usamos dX (diferença horizontal do mouse para o centro)
            // Se dX for maior que 0, o mouse está no lado direito.
            if (dX >= 0) {
                angulo = 0; // Forçamos o ângulo a ser 0 (far right)
            } else {
                // Se dX for menor que 0, o mouse está no lado esquerdo.
                angulo = -180; // Forçamos o ângulo a ser -180 (far left)
            }
        }

        // --- CONVERSÃO VISUAL ---
        // Agora que o ângulo está "limpo" (-180 a 0), fazemos a conversão final:
        // Raw -180 (Left) -> Final -90deg. Raw -90 (Up) -> Final 0deg. Raw 0 (Right) -> Final +90deg.
        let rotacaoVisual = angulo + 90;

        // Atualizamos a rotação atual da memória e aplicamos
        rotacaoAtualPonteiro = angulo;
        ponteiro.style.transform = `translateX(-50%) translateY(0%) rotate(${rotacaoVisual}deg)`;
    }
});

// 3. SOLTAR O MOUSE (mouseup na janela inteira)
window.addEventListener('mouseup', function () {
    estaArrastando = false;
});

// --- Suporte para telas de toque (Touch Events - ATUALIZADO IGUAL AO MOUSE) ---
ponteiro.addEventListener('touchstart', (e) => {
    estaArrastando = true;
    calcularCentro();
    e.preventDefault();
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (estaArrastando) {
        const touch = e.touches[0];
        const dX = touch.clientX - centroDaRoda.x;
        const dY = touch.clientY - centroDaRoda.y;

        let angulo = Math.atan2(dY, dX) * (180 / Math.PI);

        // Mesma restrição geométrica para o toque
        if (angulo > 0) {
            if (dX >= 0) {
                angulo = 0;
            } else {
                angulo = -180;
            }
        }

        let rotacaoVisual = angulo + 90;
        rotacaoAtualPonteiro = angulo;
        ponteiro.style.transform = `translateX(-50%) translateY(0%) rotate(${rotacaoVisual}deg)`;
    }
}, { passive: false });

window.addEventListener('touchend', () => {
    estaArrastando = false;
});