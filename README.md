# Babycam

App próprio (PWA) para retransmitir o baby monitor **VB603** para o seu celular, de graça.

Um celular velho Android fica preso num suporte **apontado para a tela do monitor VB603** (aproveitando a visão noturna infravermelha e o áudio do monitor) e transmite vídeo + áudio por **WebRTC** direto para o seu celular — em casa ou fora. Também dá para apontar o celular velho direto para o berço (modo "câmera direta").

- Nenhum vídeo passa por servidor nem fica guardado: a mídia vai de um celular para o outro, criptografada (DTLS-SRTP).
- O Supabase Realtime só troca as mensagens de "aperto de mão" (sinalização).
- Custo zero: Vercel (hospedagem), Supabase (sinalização/login) e STUN do Google, todos no plano gratuito.

## Andamento

| Etapa | O que entrega | Situação |
|---|---|---|
| 1 | Prova de conceito: vídeo + áudio entre dois celulares na mesma rede | **pronta para testar** |
| 2 | Login (link mágico por e-mail), sala privada, lista de e-mails autorizados, RLS | a fazer |
| 3 | TURN gratuito para assistir fora de casa (4G) | a fazer |
| 4 | Recorte da tela do VB603 com correção de perspectiva + brilho/contraste/nitidez | a fazer |
| 5 | Detecção de choro e alertas | a fazer |
| 6 | Falar com o bebê, foto, zoom, bateria, app instalável (PWA) | a fazer |

## Como usar (etapa 1)

1. No **celular velho**, abra o site e toque em **Abrir modo transmissor**. Permita câmera e microfone.
2. Escolha a câmera (traseira), resolução (720p) e quadros por segundo (15 fps) e toque em **Iniciar transmissão**.
3. Toque em **Enviar link para o celular que vai assistir** e mande o link para o seu celular (WhatsApp, por exemplo). Ou digite o código da sala na tela inicial do seu celular.
4. No **seu celular**, abra o link. Se aparecer **Tocar para ativar o som**, toque (o navegador exige um toque para liberar áudio).
5. No transmissor, **Escurecer tela** deixa a tela preta para gastar menos bateria (toque para voltar). A tela não apaga sozinha enquanto transmite.

O status no topo do visualizador mostra o caminho da conexão (rede local, internet direta ou TURN), a latência, a resolução e o consumo em kbps.

Se o Wi-Fi ou a internet cair, os dois lados se reconectam sozinhos quando ela voltar.

> Nesta etapa, **qualquer pessoa com o link da sala** consegue assistir. O código tem 12 caracteres aleatórios (impossível de adivinhar), mas não repasse o link. O botão ↻ ao lado do código gera uma sala nova (o link antigo para de funcionar). Login e lista de pessoas autorizadas chegam na etapa 2.

## Rodar localmente

```bash
cp .env.example .env   # preencha com a URL e a publishable key do Supabase
npm install
npm run dev            # abre em http://localhost:5173 e no IP da rede local
npm run build          # gera dist/ (site estático)
```

Câmera e microfone só funcionam em **https** (ou em `localhost`). Para testar nos celulares, use o deploy da Vercel.

## Configurar o Supabase

Na etapa 1 o app só usa o **Realtime (broadcast)**, que já vem ligado em todo projeto — não precisa criar tabela.

1. No painel do Supabase: **Project Settings → API**. Copie a **Project URL** e a **publishable key** (`sb_publishable_...`).
2. Coloque em `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (arquivo `.env` local e variáveis de ambiente da Vercel).
3. Nunca use a `service_role`/secret key no app.

## Deploy na Vercel

O projeto é um site estático (Vite). Na Vercel: **Add New → Project → importar o repositório `babymonitor`**. A Vercel detecta o Vite sozinha. Cadastre as duas variáveis `VITE_SUPABASE_*` em **Settings → Environment Variables** e faça um novo deploy.

## Montagem física

1. No menu do VB603, desative o desligamento automático da tela/economia de energia, para o LCD ficar sempre ligado.
2. Prenda o celular velho num suporte fixo (um suporte de celular de mesa serve) a ~10–15 cm da tela do monitor, alinhado com ela.
3. Deixe o ambiente em volta escuro para evitar reflexo no LCD.
4. Celular velho e monitor VB603 ligados na tomada o tempo todo.
5. Mantenha o cabo da câmera do VB603 a mais de 1 m do berço (risco de estrangulamento, aviso da própria caixa).

## Estrutura

| Arquivo | O que faz |
|---|---|
| `src/lib/signaling.ts` | Canal de sinalização no Supabase Realtime (só mensagens de negociação) |
| `src/lib/rtc.ts` | Conexão WebRTC, servidores ICE e leitura de estatísticas (rota, latência, kbps) |
| `src/lib/transmitter.ts` | Lado do celular velho: uma conexão por visualizador, troca de câmera sem derrubar ninguém |
| `src/lib/viewer.ts` | Lado de quem assiste: pede conexão, responde e reconecta sozinho |
| `src/lib/media.ts` | Abre a câmera/microfone com resolução e fps escolhidos |
| `src/lib/wakeLock.ts` | Mantém a tela do transmissor acesa |
| `src/pages/` | Telas: início, transmissor e visualizador |

## Limitações conhecidas (até aqui)

- Sem servidor TURN ainda: na mesma rede Wi-Fi funciona sempre; fora de casa (4G) pode não conectar em algumas operadoras. Resolvido na etapa 3.
- iPhone: o controle de volume do app não tem efeito (o iOS só aceita os botões físicos de volume).
- O transmissor precisa ficar com o site aberto em primeiro plano (o Android pode pausar a câmera se você trocar de app).
