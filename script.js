/* ============================================================
   AlvesDibo Creative Director AI — script.js v4
   API: Google AI Studio (Gemini 1.5 Flash)
   Áudio: Web Speech API (nativa, gratuita)
   ============================================================ */

// ══════════════════════════════════════════════════════════
//  🔑 INSIRA SUA API KEY AQUI (uso privado — não expor)
const GEMINI_API_KEY = '';
// ══════════════════════════════════════════════════════════

const GEMINI_MODEL = 'gemini-1.5-flash-latest';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── STATE ──
const state = {
  objetivo:         null,
  plataforma:       null,
  images:           [],   // [{ base64, mime, name }]
  lastRoteiro:      null,
  audioBlobs:       {},   // { idx: { blob, mimeType } }
  _narracaoBlocos:  []    // [{ titulo, texto }]
};

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  initBgCanvas();
  spawnFloatingIcons();
  initPills();
  initFileUpload();
  initButtons();
  checkSpeechSupport();
});

// ── VERIFICA SUPORTE WEB SPEECH API ──
function checkSpeechSupport() {
  if (!window.speechSynthesis) {
    console.warn('⚠️ Web Speech API não suportada neste navegador.');
  }
}

// ── BG CANVAS: grid holográfico + scan line ──
function initBgCanvas() {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H;

  const resize = () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(212,175,55,0.04)';
    ctx.lineWidth   = 1;
    const sp = 60;
    for (let x = 0; x < W; x += sp) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += sp) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    const sy = (Math.sin(t * 0.35) * 0.5 + 0.5) * H;
    const g  = ctx.createLinearGradient(0, sy-60, 0, sy+60);
    g.addColorStop(0,   'rgba(212,175,55,0)');
    g.addColorStop(0.5, 'rgba(212,175,55,0.055)');
    g.addColorStop(1,   'rgba(212,175,55,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, sy-60, W, 120);

    if (Math.random() < 0.025) {
      const cx = Math.floor(Math.random() * (W / sp)) * sp;
      const cy = Math.floor(Math.random() * (H / sp)) * sp;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212,175,55,${0.3 + Math.random() * 0.45})`;
      ctx.fill();
    }

    t += 0.016;
    requestAnimationFrame(draw);
  }
  draw();
}

// ── FLOATING ICONS ──
function spawnFloatingIcons() {
  const icons = ['🎬','✨','🎯','💡','🖼️','🎙️','📽️','⚡','🔥','💎','🌟','🎪','📣','🏆'];
  const container = document.getElementById('float-icons');
  icons.forEach((icon, i) => {
    const el = document.createElement('div');
    el.className   = 'fi';
    el.textContent = icon;
    el.style.left  = `${4 + (i / icons.length) * 92}%`;
    el.style.setProperty('--dur',   `${13 + Math.random() * 13}s`);
    el.style.setProperty('--delay', `${-Math.random() * 20}s`);
    container.appendChild(el);
  });
}

// ── PILLS ──
// Cada botão só remove .active dos outros botões do SEU grupo (data-group),
// garantindo que grupos diferentes (objetivo vs plataforma) sejam independentes.
function initPills() {
  const allBtns = document.querySelectorAll('.pill[data-group], .pill-yt[data-group]');
  
  allBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      const value = btn.dataset.value;

      // REMOVE O ATIVO APENAS DOS BOTÕES DO MESMO GRUPO
      document.querySelectorAll(`[data-group="${group}"]`).forEach(b => {
        b.classList.remove('active');
      });

      // Ativa o botão clicado
      btn.classList.add('active');
      state[group] = value;
    });
  });
}
// ── FILE UPLOAD (até 3 imagens → inline_data para Gemini) ──
function initFileUpload() {
  const input = document.getElementById('product-images');
  const chips = document.getElementById('file-chips');

  input.addEventListener('change', () => {
    const files = Array.from(input.files).slice(0, 3);
    state.images = [];
    chips.innerHTML = '';

    if (!files.length) {
      chips.innerHTML = '<span class="no-file">Nenhum arquivo selecionado</span>';
      return;
    }

    let loaded = 0;
    files.forEach(file => {
      const chip = document.createElement('span');
      chip.className   = 'file-chip';
      chip.textContent = file.name;
      chips.appendChild(chip);

      const reader = new FileReader();
      reader.onload = e => {
        state.images.push({
          base64: e.target.result.split(',')[1],
          mime:   file.type,
          name:   file.name
        });
        loaded++;
        if (loaded === files.length) {
          showToast(`📎 ${loaded} imagem(ns) prontas para envio ao Gemini.`, 'success');
        }
      };
      reader.onerror = () => showToast(`❌ Erro ao ler ${file.name}`, 'error');
      reader.readAsDataURL(file);
    });
  });
}

// ── BUTTONS ──
function initButtons() {
  document.getElementById('btn-gerar').addEventListener('click', handleGerar);
  document.getElementById('btn-narracao').addEventListener('click', handleNarracao);
  document.getElementById('btn-imagens').addEventListener('click', () => showToast('🖼️ Funcionalidade em breve!', 'info'));
  document.getElementById('btn-copy').addEventListener('click', copyResult);
  document.getElementById('btn-clear').addEventListener('click', clearResult);
}

// ─────────────────────────────────────────────────────────
//  GERAR ROTEIRO
// ─────────────────────────────────────────────────────────
async function handleGerar() {
  if (!state.objetivo)   return showToast('🎯 Selecione o Objetivo.', 'error');
  if (!state.plataforma) return showToast('📱 Selecione a Plataforma.', 'error');

  state.audioBlobs      = {};
  state._narracaoBlocos = [];
  state.lastRoteiro     = null;

  const url    = document.getElementById('product-link').value.trim();
  const extra  = document.getElementById('extra-prompt').value.trim();
  const info   = getPlatInfo(state.plataforma);
  const prompt = buildPromptRoteiro(info, url, extra);

  setLoading(true, 'Gerando roteiro com IA…');
  try {
    const roteiro     = await callGeminiJSON(prompt);
    state.lastRoteiro = roteiro;
    renderRoteiro(roteiro, info);
  } catch (err) {
    showToast(`❌ ${err.message}`, 'error');
    console.error(err);
  } finally {
    setLoading(false);
  }
}

// ─────────────────────────────────────────────────────────
//  GERAR NARRAÇÃO (texto via Gemini → áudio via Web Speech API)
// ─────────────────────────────────────────────────────────
async function handleNarracao() {
  const out = document.getElementById('table-output');
  if (out.style.display === 'none' || !out.textContent.trim()) {
    return showToast('⚠️ Gere um roteiro primeiro.', 'warning');
  }
  if (!window.speechSynthesis) {
    return showToast('❌ Seu navegador não suporta Web Speech API.', 'error');
  }

  const prompt = buildPromptNarracao(out.innerText);

  setLoading(true, 'Gerando texto da narração com IA…');
  let textoNarracao = '';
  try {
    textoNarracao = await callGeminiRaw(prompt);
  } catch (err) {
    setLoading(false);
    return showToast(`❌ ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }

  const blocos = parseBlocosCena(textoNarracao);
  state._narracaoBlocos = blocos;
  renderNarracaoComAudio(blocos);
}

// ── Parser: divide texto da narração em blocos por cena ──
function parseBlocosCena(texto) {
  const blocos = [];
  const linhas = texto.split('\n');
  let cenaAtual   = null;
  let linhasAtual = [];

  const isCabecalho = (l) =>
    /^\[cena\s*\d+\]/i.test(l.trim()) ||
    /^cena\s*\d+\s*[:\-–]/i.test(l.trim()) ||
    /^\*{1,2}cena\s*\d+/i.test(l.trim()) ||
    /^---\s*cena\s*\d+/i.test(l.trim());

  linhas.forEach(linha => {
    if (isCabecalho(linha)) {
      if (cenaAtual !== null && linhasAtual.length) {
        blocos.push({ titulo: cenaAtual, texto: linhasAtual.join(' ').trim() });
      }
      cenaAtual   = linha.replace(/[\[\]\*\-–:]/g, '').trim();
      linhasAtual = [];
    } else if (linha.trim()) {
      linhasAtual.push(linha.trim());
    }
  });

  if (cenaAtual !== null && linhasAtual.length) {
    blocos.push({ titulo: cenaAtual, texto: linhasAtual.join(' ').trim() });
  }

  // fallback: sem marcadores de cena encontrados
  if (!blocos.length) {
    const paragrafos = texto.split(/\n{2,}/).filter(p => p.trim());
    paragrafos.forEach((p, i) => {
      blocos.push({ titulo: `Cena ${i + 1}`, texto: p.trim() });
    });
  }

  if (!blocos.length) {
    blocos.push({ titulo: 'Narração', texto: texto.trim() });
  }

  return blocos;
}

// ─────────────────────────────────────────────────────────
//  RENDER NARRAÇÃO + PLAYERS DE ÁUDIO
// ─────────────────────────────────────────────────────────
function renderNarracaoComAudio(blocos) {
  const out  = document.getElementById('table-output');
  const prev = out.querySelector('.narracao-section');
  if (prev) prev.remove();

  const section = document.createElement('div');
  section.className = 'narracao-section';

  let cardsHTML = blocos.map((bloco, idx) => `
    <div class="audio-card" id="audio-card-${idx}">
      <div class="audio-card-header">
        <span class="audio-cena-badge">${escHtml(bloco.titulo)}</span>
        <span class="audio-status" id="status-${idx}">Pronto</span>
      </div>
      <p class="audio-texto" id="texto-${idx}">${escHtml(bloco.texto)}</p>
      <div class="audio-controls">
        <button class="btn-audio btn-audio-play"  id="btn-play-${idx}"   onclick="speakCena(${idx})">▶ Ouvir</button>
        <button class="btn-audio btn-audio-stop"  id="btn-stop-${idx}"   onclick="stopCena()"  disabled>■ Parar</button>
        <button class="btn-audio btn-audio-rec"   id="btn-gravar-${idx}" onclick="gravarCena(${idx})">⏺ Gravar</button>
        <button class="btn-audio btn-audio-dl"    id="btn-dl-${idx}"     onclick="downloadAudio(${idx})" disabled>⬇ Baixar</button>
      </div>
      <div class="audio-player-wrap" id="player-wrap-${idx}" style="display:none">
        <audio id="player-${idx}" controls></audio>
      </div>
    </div>
  `).join('');

  section.innerHTML = `
    <div class="narracao-label">◈ NARRAÇÃO — PLAYERS DE ÁUDIO</div>
    <p class="narracao-hint">
      ▶ <strong>Ouvir</strong>: reproduz via síntese de voz &nbsp;|&nbsp;
      ⏺ <strong>Gravar</strong>: captura o áudio &nbsp;|&nbsp;
      ⬇ <strong>Baixar</strong>: salva o arquivo gravado
    </p>
    <div class="narracao-blocos">${cardsHTML}</div>
  `;

  out.appendChild(section);
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('🎙️ Narração pronta! Use ▶ Ouvir ou ⏺ Gravar em cada cena.', 'success');
}

// ─────────────────────────────────────────────────────────
//  WEB SPEECH API — REPRODUÇÃO
// ─────────────────────────────────────────────────────────
function speakCena(idx) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const bloco      = state._narracaoBlocos[idx];
  const utterance  = buildUtterance(bloco.texto);

  setAudioStatus(idx, '🔊 Reproduzindo…', true);
  utterance.onend   = () => setAudioStatus(idx, 'Concluído ✓', false);
  utterance.onerror = () => setAudioStatus(idx, '❌ Erro', false);

  window.speechSynthesis.speak(utterance);
}

function stopCena() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  // reseta todos os status ativos
  document.querySelectorAll('.audio-status').forEach(el => {
    if (el.textContent === '🔊 Reproduzindo…' || el.textContent === '⏺ Gravando…') {
      el.textContent = 'Parado';
    }
  });
  document.querySelectorAll('[id^="btn-stop-"]').forEach(b => b.disabled = true);
  document.querySelectorAll('[id^="btn-play-"]').forEach(b => b.disabled = false);
}

// ─────────────────────────────────────────────────────────
//  WEB SPEECH API — GRAVAÇÃO (MediaRecorder)
//  Usa AudioContext + MediaStreamDestination para capturar
//  a síntese de voz em um stream gravável.
// ─────────────────────────────────────────────────────────
async function gravarCena(idx) {
  if (!window.speechSynthesis) return showToast('❌ Web Speech API não disponível.', 'error');
  if (!window.MediaRecorder)   return showToast('❌ MediaRecorder não suportado.', 'error');

  const bloco = state._narracaoBlocos[idx];

  setAudioStatus(idx, '⏺ Gravando…', true);
  document.getElementById(`btn-gravar-${idx}`).disabled = true;
  document.getElementById(`btn-play-${idx}`).disabled   = true;

  try {
    const AudioCtx  = window.AudioContext || window.webkitAudioContext;
    const audioCtx  = new AudioCtx();
    const dest      = audioCtx.createMediaStreamDestination();

    // Oscilador silencioso para manter o stream vivo
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(dest);
    osc.start();

    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(dest.stream, mimeType ? { mimeType } : {});
    const chunks   = [];

    recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = () => {
      osc.stop();
      audioCtx.close();

      const finalMime = mimeType || 'audio/webm';
      const blob      = new Blob(chunks, { type: finalMime });
      state.audioBlobs[idx] = { blob, mimeType: finalMime };

      const url    = URL.createObjectURL(blob);
      const player = document.getElementById(`player-${idx}`);
      const wrap   = document.getElementById(`player-wrap-${idx}`);
      player.src         = url;
      wrap.style.display = 'block';

      document.getElementById(`btn-dl-${idx}`).disabled     = false;
      document.getElementById(`btn-gravar-${idx}`).disabled  = false;
      document.getElementById(`btn-play-${idx}`).disabled    = false;
      setAudioStatus(idx, '✅ Pronto para download', false);
      showToast(`✅ Cena ${idx + 1} gravada com sucesso!`, 'success');
    };

    recorder.start(100); // coleta dados a cada 100ms

    const utterance = buildUtterance(bloco.texto);
    utterance.onend = () => {
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 700);
    };
    utterance.onerror = () => {
      if (recorder.state === 'recording') recorder.stop();
      setAudioStatus(idx, '❌ Erro na fala', false);
      document.getElementById(`btn-gravar-${idx}`).disabled = false;
      document.getElementById(`btn-play-${idx}`).disabled   = false;
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

  } catch (err) {
    console.error('Erro ao gravar:', err);
    setAudioStatus(idx, '❌ Erro', false);
    document.getElementById(`btn-gravar-${idx}`).disabled = false;
    document.getElementById(`btn-play-${idx}`).disabled   = false;
    showToast(`❌ Não foi possível gravar: ${err.message}`, 'error');
  }
}

// ── Cria e configura um SpeechSynthesisUtterance em pt-BR ──
function buildUtterance(texto) {
  const utt    = new SpeechSynthesisUtterance(texto);
  utt.lang     = 'pt-BR';
  utt.rate     = 0.95;
  utt.pitch    = 1.0;
  utt.volume   = 1.0;

  // Aguarda vozes carregarem (Chrome lazy-load)
  const setVoice = () => {
    const vozes = window.speechSynthesis.getVoices();
    const vozPT = vozes.find(v => v.lang === 'pt-BR' || v.lang === 'pt_BR');
    if (vozPT) utt.voice = vozPT;
  };
  setVoice();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = setVoice;
  }

  return utt;
}

// ── mimeType suportado pelo MediaRecorder ──
function getSupportedMimeType() {
  const tipos = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  return tipos.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

// ── Download do blob gravado ──
function downloadAudio(idx) {
  const entry = state.audioBlobs[idx];
  if (!entry) return showToast('⚠️ Grave o áudio antes de baixar.', 'warning');

  const ext  = entry.mimeType.includes('ogg') ? 'ogg' : 'webm';
  const url  = URL.createObjectURL(entry.blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `AlvesDibo_Cena_${idx + 1}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`⬇ Download Cena ${idx + 1} iniciado!`, 'success');
}

// ── Atualiza status e estado dos botões de um card ──
function setAudioStatus(idx, msg, ativo) {
  const statusEl = document.getElementById(`status-${idx}`);
  const btnStop  = document.getElementById(`btn-stop-${idx}`);
  const btnPlay  = document.getElementById(`btn-play-${idx}`);
  if (statusEl) statusEl.textContent = msg;
  if (btnStop)  btnStop.disabled     = !ativo;
  if (btnPlay)  btnPlay.disabled     =  ativo;
}

// ─────────────────────────────────────────────────────────
//  PLATFORM INFO
// ─────────────────────────────────────────────────────────
function getPlatInfo(p) {
  const map = {
    'ML Clips':      { dur:30,  cenas:3,  fmt:'9:16', nome:'Mercado Livre Clips' },
    'Shopee Video':  { dur:30,  cenas:3,  fmt:'9:16', nome:'Shopee Video' },
    'TikTok':        { dur:30,  cenas:3,  fmt:'9:16', nome:'TikTok' },
    'Insta Reels':   { dur:30,  cenas:3,  fmt:'9:16', nome:'Instagram Reels' },
    'Face Reels':    { dur:30,  cenas:3,  fmt:'9:16', nome:'Facebook Reels' },
    'YT Shorts':     { dur:30,  cenas:3,  fmt:'9:16', nome:'YouTube Shorts' },
    'YouTube Longo': { dur:120, cenas:15, fmt:'16:9', nome:'YouTube (Longo)' },
  };
  return map[p] || { dur:30, cenas:3, fmt:'9:16', nome:p };
}

// ─────────────────────────────────────────────────────────
//  PROMPTS
// ─────────────────────────────────────────────────────────
function buildPromptRoteiro(info, url, extra) {
  return `Você é um Diretor Criativo especialista em marketing de vídeo para e-commerce e redes sociais brasileiras.

Crie um roteiro de vídeo detalhado seguindo EXATAMENTE as regras abaixo:

## CONFIGURAÇÃO
- Plataforma: ${info.nome}
- Formato: ${info.fmt}
- Duração total: ${info.dur} segundos
- Número de cenas: ${info.cenas}
- Objetivo: ${state.objetivo}
${url   ? `- Produto/Link: ${url}` : ''}
${extra ? `- Detalhes: ${extra}`   : ''}

## REGRA OBRIGATÓRIA
Cada cena deve ter EXATAMENTE 8 segundos de duração.

## TOM POR OBJETIVO
- Venda Direta: urgência, benefícios diretos, preço, CTA forte
- Autoridade: dados, expertise, prova social, credibilidade
- Conexão: storytelling, emoção, identificação, comunidade

## RESPONDA APENAS com JSON válido (sem markdown, sem texto fora do JSON):
{"titulo":"...","descricao":"...","cenas":[{"numero":1,"duracao":8,"visual":"...","audio":"...","cta":"...","hook":"..."}],"musica_sugerida":"...","hashtags":["..."],"cta_final":"..."}`.trim();
}

function buildPromptNarracao(roteiroTexto) {
  return `Com base neste roteiro de vídeo:\n\n${roteiroTexto}\n\nCrie uma narração em off profissional em português brasileiro.\n\nRegras OBRIGATÓRIAS:\n- Divida por cena usando EXATAMENTE o formato: [Cena 1], [Cena 2], [Cena 3]...\n- Cada bloco começa com [Cena N] em linha separada\n- Texto de cada cena na linha seguinte, sem formatação extra\n- Tom: ${state.objetivo} para ${state.plataforma}\n- Seja persuasivo, fluido e natural para leitura em voz alta\n- NÃO inclua JSON, markdown, asteriscos ou traços\n\nExemplo de formato esperado:\n[Cena 1]\nTexto da narração para a cena 1 aqui.\n\n[Cena 2]\nTexto da narração para a cena 2 aqui.`.trim();
}

// ─────────────────────────────────────────────────────────
//  CHAMADAS GEMINI API
// ─────────────────────────────────────────────────────────

// Envia prompt + imagens como inline_data → retorna JSON
async function callGeminiJSON(prompt) {
  const parts = [{ text: prompt }];

  // Imagens enviadas como inline_data antes do texto
  state.images.forEach(img => {
    parts.unshift({
      inline_data: {
        mime_type: img.mime,
        data:      img.base64
      }
    });
  });

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.85, topP: 0.95, maxOutputTokens: 4096 }
    })
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Resposta vazia da API. Tente novamente.');

  const clean = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('Formato inválido na resposta da IA. Tente novamente.');
  }
}

// Envia prompt → retorna texto livre
async function callGeminiRaw(prompt) {
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, topP: 0.95, maxOutputTokens: 2048 }
    })
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Resposta vazia da API.');
  return text;
}

// ─────────────────────────────────────────────────────────
//  RENDER ROTEIRO
// ─────────────────────────────────────────────────────────
function renderRoteiro(r, info) {
  const cenas = r.cenas || [];
  const total = cenas.reduce((a, c) => a + (c.duracao || 8), 0);
  const out   = document.getElementById('table-output');

  out.innerHTML = `
    <div class="summary-chips">
      <span class="chip">📽️ ${escHtml(r.titulo || 'Roteiro')}</span>
      <span class="chip">🎯 ${state.objetivo}</span>
      <span class="chip">📱 ${info.nome}</span>
      <span class="chip">⏱️ ${total}s</span>
      <span class="chip">🎬 ${cenas.length} cenas × 8s</span>
    </div>
    ${r.descricao ? `<p style="font-size:.79rem;color:var(--cinza);margin-bottom:14px;font-style:italic;">"${escHtml(r.descricao)}"</p>` : ''}
    <div style="overflow-x:auto">
      <table class="roteiro-table">
        <thead>
          <tr>
            <th>Cena</th>
            <th>🎥 Visual</th>
            <th>🎙️ Áudio / Texto</th>
            <th>📣 CTA</th>
            <th>💡 Gancho</th>
          </tr>
        </thead>
        <tbody>
          ${cenas.map((c, i) => `
            <tr>
              <td>
                <span class="cena-badge">Cena ${c.numero || i + 1}</span><br/>
                <span class="dur-badge">⏱ ${c.duracao || 8}s</span>
              </td>
              <td>${escHtml(c.visual || '—')}</td>
              <td>${escHtml(c.audio  || '—')}</td>
              <td>${escHtml(c.cta   || '—')}</td>
              <td>${escHtml(c.hook  || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="extras">
      ${r.musica_sugerida ? `<span class="chip" style="width:fit-content">🎵 ${escHtml(r.musica_sugerida)}</span>` : ''}
      ${r.cta_final       ? `<span class="chip" style="width:fit-content">📣 ${escHtml(r.cta_final)}</span>`       : ''}
      ${r.hashtags?.length ? `<div class="tags-line">${r.hashtags.map(h => `#${h}`).join(' ')}</div>`               : ''}
    </div>
  `;

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('loader').style.display      = 'none';
  out.style.display = 'block';
  showToast('✅ Roteiro gerado! Clique em 🎙️ GERAR NARRAÇÃO para criar os áudios.', 'success');
}

// ─────────────────────────────────────────────────────────
//  UTILITÁRIOS
// ─────────────────────────────────────────────────────────
function copyResult() {
  const t = document.getElementById('table-output');
  if (!t.textContent.trim()) return showToast('Nenhum conteúdo para copiar.', 'error');
  navigator.clipboard.writeText(t.innerText)
    .then(()  => showToast('📋 Copiado para a área de transferência!', 'success'))
    .catch(()  => showToast('Erro ao copiar.', 'error'));
}

function clearResult() {
  window.speechSynthesis?.cancel();
  state.audioBlobs      = {};
  state._narracaoBlocos = [];
  state.lastRoteiro     = null;

  const t = document.getElementById('table-output');
  t.innerHTML     = '';
  t.style.display = 'none';
  document.getElementById('empty-state').style.display = 'flex';
}

function setLoading(on, msg = 'Processando com IA…') {
  const loader = document.getElementById('loader');
  const empty  = document.getElementById('empty-state');
  const out    = document.getElementById('table-output');
  const btn    = document.getElementById('btn-gerar');

  if (on) {
    loader.style.display = 'flex';
    empty.style.display  = 'none';
    const lm = document.getElementById('loader-msg');
    if (lm) lm.textContent = msg;
  } else {
    loader.style.display = 'none';
    if (!out.innerHTML.trim()) empty.style.display = 'flex';
  }

  btn.disabled    = on;
  btn.textContent = on ? '⏳ Processando…' : '✦ GERAR ROTEIRO';
}

let toastTimer = null;
function showToast(msg, type = 'info') {
  const t       = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type}`;
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, 4000);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/\n/g, '<br/>');
}
