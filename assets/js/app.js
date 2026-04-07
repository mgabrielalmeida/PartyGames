/* =========================================
   app.js - Lógica Global e Transições
   ========================================= */

// Usamos 'pageshow' em vez de 'DOMContentLoaded' para garantir que 
// a transição funcione mesmo se o usuário usar o botão de voltar do navegador
window.addEventListener('pageshow', (event) => {

    // 1. FADE-IN DE ENTRADA
    // Removemos a classe de saída (caso exista) e adicionamos a de entrada
    document.body.classList.remove('page-exit');

    setTimeout(() => {
        document.body.classList.add('page-loaded');
    }, 50);

    // 2. CONFIGURAÇÃO DO SOM DE CLIQUE
    // Crie a pasta 'audio' dentro de 'assets' e coloque um arquivo de som curto lá
    const clickSound = new Audio('assets/audio/click.mp3');
    clickSound.volume = 0.5; // Volume em 50% para não ser muito alto

    // 3. INTERCEPTAR LINKS (FADE-OUT E SOM)
    // Seleciona todos os links da página (botões e cartões)
    const links = document.querySelectorAll('a');

    links.forEach(link => {
        link.addEventListener('click', (event) => {

            // TOCA O SOM
            // Usamos cloneNode para permitir que o som toque por cima dele mesmo
            // se o usuário clicar muito rápido várias vezes
            clickSound.cloneNode(true).play().catch(error => {
                // Navegadores bloqueiam áudio se o usuário não tiver interagido com a página antes.
                // O .catch evita que o console dê erro na primeira página.
                console.log("Áudio aguardando interação do usuário.");
            });

            // TRANSIÇÃO DE SAÍDA (Apenas para links do próprio site)
            // Verifica se o link tem um destino e não abre em uma nova aba
            if (link.href && link.target !== '_blank') {

                // Impede o navegador de mudar de página instantaneamente
                event.preventDefault();

                const targetUrl = link.href;

                // Remove a classe de entrada e adiciona a de saída (Fade-out)
                document.body.classList.remove('page-loaded');
                document.body.classList.add('page-exit');

                // Aguarda 400 milissegundos (o mesmo tempo da transição no CSS)
                // e então força o navegador a ir para a nova página
                setTimeout(() => {
                    window.location.href = targetUrl;
                }, 400);
            }
        });
    });
});