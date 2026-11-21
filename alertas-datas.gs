/**
 * 🤖 ALERTS-BOT ⏰ — Agenda do Mestrado (Google Apps Script)
 *
 * Lê um Google Doc (ou .txt) partilhado no Google Drive e envia todos os dias um email, para ti e para os colegas com acesso de edição ao ficheiro. 
 * O email está organizado em:
 *
 *   Hoje · Amanhã · Próximos 7 dias · Próximos 15 dias · Próximos 30 dias
 *
 * Sintaxe de cada linha:   DATA - EVENTO
 *
 *   23/11/2026 - Entrega do trabalho de Criptografia (SRSI)
 *   27/11/2026 - Exame de Aprendizagem Automática
 *
 * Cada evento aparece todos os dias com a contagem decrescente (T-N), desde que faltem 30 dias até ao próprio dia.
 *
 * O script ignora:
 *   - o bloco de comentário (barra-asterisco ... asterisco-barra), se existir
 *   - texto dentro de tabelas
 *   - linhas sem data (títulos, notas, linhas vazias), datas impossíveis e eventos que já passaram
 */

// ===== CONFIGURAÇÃO =====
const FILE_ID = 'FILE_ID'; // parte do URL entre /d/ e /edit
const INCLUIR_PARTILHADOS = true;                 // envia também para quem tem acesso de edição ao ficheiro
const EMAILS_EXTRA = ['EMAIL_EXTRA'];         // outros destinatários
const EMAIL_TESTE = 'EMAIL_TESTE';               // único destinatário de testarSoParaMim()
const HORA_DO_EMAIL = 8;                          // hora aproximada do envio diário
const NOME_BOT = 'ALERTS-BOT';                    // nome do remetente e do cabeçalho
const MENSAGEM_BOT = 'Mapa de festas do Semestre';
const DESTAQUE_HOJE = true;                       // true = secção Hoje num painel destacado
const MOSTRAR_SECOES_VAZIAS = false;              // true = mostra todas as secções, mesmo vazias
const ASSUNTO_COM_DATA = true;                    // true = "· sáb 21/11 ·" no assunto (evita que o Gmail agrupe os emails)

// Janelas de tempo (de/ate = dias que faltam, inclusive)
const JANELAS = [
  { titulo: 'Hoje',             de: 0,  ate: 0,  nivel: 'critico' },
  { titulo: 'Amanhã',           de: 1,  ate: 1,  nivel: 'alerta'  },
  { titulo: 'Próximos 7 dias',  de: 2,  ate: 7,  nivel: 'alerta'  },
  { titulo: 'Próximos 15 dias', de: 8,  ate: 15, nivel: 'info'    },
  { titulo: 'Próximos 30 dias', de: 16, ate: 30, nivel: 'longe'   },
];

// Tema "ISCTE-tech": claro, cabeçalho azul-marinho e acentos azuis. (cores inspiradas no ISCTE)
// Cada nível tem a cor principal e um tom claro para o fundo da etiqueta.
const T = {
  fundo: '#eef1f5', painel: '#ffffff', marinho: '#0a1f44', azul: '#1f5fbf', azulClaro: '#e8f0fb',
  linha: '#dfe4ec', texto: '#1b2433', suave: '#6b7688', subtitulo: '#c9d6ee', etiqueta: '#8fb3ff',
  hojeFundo: '#fdf1f1', hojeBorda: '#f3c6c6',
  niveis: {
    critico: { cor: '#c62828', tom: '#fbe4e4' },
    alerta:  { cor: '#c77700', tom: '#fbf0dc' },
    info:    { cor: '#1f5fbf', tom: '#e3ecfa' },
    longe:   { cor: '#8a94a6', tom: '#eef0f4' }
  }
};

// ===== FUNÇÕES PARA EXECUTAR =====

/**
 * Função principal, chamada todos os dias pelo acionador.
 * Envia o email para todos (eu, editores do ficheiro e EMAILS_EXTRA).
 */
function verificarDatas() {
  enviar_(destinatarios_());
}

/** Enviar JÁ o email para TODOS os destinatários. */
function testar() {
  verificarDatas();
}

/** Envia o email só para EMAIL_TESTE. */
function testarSoParaMim() {
  enviar_([EMAIL_TESTE], '[TESTE] ');
}

/**
 * Cria o acionador diário. Corre UMA vez (e de novo se mudares HORA_DO_EMAIL).
 * Apaga primeiro qualquer acionador antigo desta função, para não haver duplicados.
 */
function criarAcionador() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'verificarDatas')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('verificarDatas')
    .timeBased().everyDays(1).atHour(HORA_DO_EMAIL).create();
}

/**
 * Lê o ficheiro, monta o email do dia e envia-o.
 * @param {string[]} destinos  endereços de email
 * @param {string}   [prefixo] texto opcional no início do assunto
 */
function enviar_(destinos, prefixo) {
  const hoje = semHoras_(new Date());
  const dados = recolher_(lerItens_(hoje));
  MailApp.sendEmail(
    destinos.join(','),
    (prefixo || '') + montarAssunto_(dados, hoje),
    montarTexto_(dados, hoje),
    { htmlBody: montarHtml_(dados, hoje), name: NOME_BOT }
  );
}

/** Eu, o dono (se não for eu LoL) e os editores do ficheiro (se INCLUIR_PARTILHADOS) e EMAILS_EXTRA, sem repetidos. */
function destinatarios_() {
  const emails = new Set(EMAILS_EXTRA);
  const meu = Session.getEffectiveUser().getEmail();
  if (meu) emails.add(meu);
  if (INCLUIR_PARTILHADOS) {
    const f = DriveApp.getFileById(FILE_ID);
    const dono = f.getOwner();
    if (dono) emails.add(dono.getEmail());
    f.getEditors().forEach(u => emails.add(u.getEmail()));
  }
  return [...emails].filter(Boolean);
}

// ===== LEITURA DO FICHEIRO =====

/**
 * Lê o ficheiro e devolve só as linhas que interessam.
 * - Google Doc: cada parágrafo é uma linha; parágrafos dentro de tabelas são ignorados.
 * - .txt: cada linha do ficheiro é uma linha.
 * Em ambos os casos ignora o bloco de comentário, se existir.
 * @return {Object[]} cada linha tem: texto e html(ini, fim)
 */
function lerLinhas_() {
  const ficheiro = DriveApp.getFileById(FILE_ID);
  let brutas;

  if (ficheiro.getMimeType() === MimeType.GOOGLE_DOCS) {
    brutas = DocumentApp.openById(FILE_ID).getBody().getParagraphs()
      .filter(p => p.getParent().getType() !== DocumentApp.ElementType.TABLE_CELL) // ignora tabelas
      .map(p => ({ texto: p.getText(), html: (ini, fim) => paragrafoParaHtml_(p, ini, fim) }));
  } else {
    brutas = ficheiro.getBlob().getDataAsString().split(/\r?\n/)
      .map(l => ({ texto: l, html: (ini, fim) => escapar_(l.slice(ini, fim)) }));
  }

  const linhas = [];
  let emComentario = false;
  for (const linha of brutas) {
    const s = linha.texto.trim();
    if (!emComentario && s.startsWith('/*')) { emComentario = !s.slice(2).includes('*/'); continue; }
    if (emComentario) { if (s.includes('*/')) emComentario = false; continue; }
    linhas.push(linha);
  }
  return linhas;
}

/**
 * Transforma cada linha com data num evento: data, dias que faltam e texto a mostrar.
 * A data do início da linha é retirada do texto (aparece formatada à parte).
 * @param {Date} hoje
 * @return {Object[]} eventos futuros (incluindo hoje)
 */
function lerItens_(hoje) {
  const itens = [];

  lerLinhas_().forEach(linha => {
    const bruto = linha.texto;
    let ini = bruto.match(/^[\s\-–•*]*/)[0].length; // ignora marcadores ("- ", "• ")
    const fim = bruto.length;

    const d = lerData_(bruto.slice(ini), hoje);
    if (!d) return;                                   // sem data → título ou nota
    const faltam = diasEntre_(hoje, d.data);
    if (faltam < 0) return;                           // já passou

    // Se a linha começa pela data, o texto mostrado começa depois dela e do separador
    if (d.indice === 0) {
      const resto = bruto.slice(ini + d.tamanho);
      ini += d.tamanho + resto.match(/^\s*[-–—:|]?\s*/)[0].length;
    }
    const texto = bruto.slice(ini, fim).trim();

    itens.push({
      texto: texto || bruto.trim(),
      html: texto ? linha.html(ini, fim).trim() : escapar_(bruto.trim()),
      data: d.data,
      faltam: faltam
    });
  });

  return itens;
}

/**
 * Procura a primeira data na linha: dd/mm, dd/mm/aa ou dd/mm/aaaa (também com - ou .).
 * Sem ano e já passou este ano → assume o ano seguinte.
 * @return {?{data: Date, indice: number, tamanho: number}}
 */
function lerData_(s, hoje) {
  const m = s.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
  if (!m) return null;
  const dia = +m[1], mes = +m[2] - 1;

  let ano = m[3] ? +m[3] : hoje.getFullYear();
  if (ano < 100) ano += 2000;
  let data = new Date(ano, mes, dia);
  if (data.getMonth() !== mes || data.getDate() !== dia) return null; // ex.: 31/02
  if (!m[3] && data < hoje) data = new Date(ano + 1, mes, dia);
  return { data: data, indice: m.index, tamanho: m[0].length };
}

/** Distribui os eventos pelas janelas de tempo e calcula os contadores. */
function recolher_(itens) {
  const porData = (a, b) => (a.faltam - b.faltam) || a.texto.localeCompare(b.texto);
  const janelas = JANELAS.map(j => ({
    titulo: j.titulo, nivel: j.nivel,
    itens: itens.filter(i => i.faltam >= j.de && i.faltam <= j.ate).sort(porData)
  }));
  const n = k => janelas[k].itens.length;
  return {
    janelas: janelas,
    nHoje: n(0),
    nAmanha: n(1),
    n7: n(0) + n(1) + n(2),
    n30: janelas.reduce((s, j) => s + j.itens.length, 0),
    nTotal: itens.length
  };
}

// ===== MONTAGEM DO EMAIL =====

/** Assunto do email, ex.: "🤖 ALERTS-BOT ⏰ · sáb 21/11 · 2 hoje". */
function montarAssunto_(d, hoje) {
  return '🤖 ' + NOME_BOT + ' ⏰ · ' + (ASSUNTO_COM_DATA ? dataCurta_(hoje, hoje) + ' · ' : '') + d.nHoje + ' hoje';
}

/** Etiqueta à esquerda de cada evento: HOJE ou T-NN. */
function insignia_(i) {
  return i.faltam === 0 ? 'HOJE' : 'T-' + pad2_(i.faltam);
}

/** Versão em texto simples do email (para clientes que não mostram HTML). */
function montarTexto_(d, hoje) {
  const linhas = ['🤖 ' + NOME_BOT + ' ⏰ — relatório de ' + dataLonga_(hoje), '> ' + MENSAGEM_BOT, ''];
  d.janelas.forEach(j => {
    if (!j.itens.length && !MOSTRAR_SECOES_VAZIAS) return;
    linhas.push('▸ ' + j.titulo.toUpperCase());
    if (!j.itens.length) linhas.push('  (nenhum)');
    j.itens.forEach(i => linhas.push('  • [' + insignia_(i) + '] ' + i.texto + '  (' + dataCurta_(i.data, hoje) + ')'));
    linhas.push('');
  });
  if (!d.n30 && !MOSTRAR_SECOES_VAZIAS) linhas.push('Nada nos próximos ' + JANELAS[JANELAS.length - 1].ate + ' dias.', '');
  linhas.push('Ficheiro: https://drive.google.com/open?id=' + FILE_ID);
  return linhas.join('\n');
}

/**
 * Versão HTML do email, no tema "ISCTE-tech".
 */
function montarHtml_(d, hoje) {
  const SANS = "font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;";
  const MONO = "font-family:'Consolas','SFMono-Regular','Menlo','Courier New',monospace;";
  const TAB = 'role="presentation" width="100%" cellpadding="0" cellspacing="0"';
  const limite = JANELAS[JANELAS.length - 1].ate;
  const link = 'https://drive.google.com/open?id=' + FILE_ID;

  // Cartão de um evento: etiqueta (HOJE / T-NN), texto do Doc e data
  const item = (i, n) =>
    '<tr><td style="padding:4px 0;">' +
      '<table ' + TAB + ' style="background:#ffffff;border:1px solid ' + T.linha + ';border-left:4px solid ' + n.cor + ';border-radius:6px;">' +
        '<tr>' +
          '<td style="width:66px;padding:10px 0 10px 12px;vertical-align:top;">' +
            '<span style="' + MONO + 'font-size:11px;font-weight:bold;color:' + n.cor + ';background:' + n.tom + ';padding:3px 6px;border-radius:4px;white-space:nowrap;">' + insignia_(i) + '</span>' +
          '</td>' +
          '<td style="padding:9px 12px;font-size:14px;line-height:1.45;color:' + T.texto + ';">' +
            i.html.replace(/\{\{LINK\}\}/g, T.azul) +
            '<div style="' + MONO + 'font-size:11px;color:' + T.suave + ';margin-top:2px;">' + dataCurta_(i.data, hoje) + '</div>' +
          '</td>' +
        '</tr>' +
      '</table>' +
    '</td></tr>';

  // Título de secção, ex.: "PRÓXIMOS 7 DIAS · 2"
  const titulo = (txt, qtd, n) =>
    '<tr><td style="padding:16px 0 4px;font-size:12px;font-weight:bold;letter-spacing:1.5px;color:' + n.cor + ';">' +
      escapar_(txt) + ' <span style="color:' + T.suave + ';font-weight:normal;">· ' + qtd + '</span>' +
    '</td></tr>';

  const secao = (j, destaque) => {
    const n = T.niveis[j.nivel];
    if (!j.itens.length && !MOSTRAR_SECOES_VAZIAS && !destaque) return '';
    const txt = destaque ? '● ' + j.titulo.toUpperCase() + ' · ' + dataCurta_(hoje, hoje).toUpperCase() : j.titulo.toUpperCase();
    const linhas = titulo(txt, j.itens.length, n) + (j.itens.length
      ? j.itens.map(i => item(i, n)).join('')
      : '<tr><td style="padding:2px 0 6px;font-size:13px;color:' + T.suave + ';">' +
          (destaque ? 'Nada agendado para hoje.' : '— sem registos —') + '</td></tr>');
    if (!destaque) return linhas;
    // Painel destacado para o Hoje
    return '<tr><td style="padding-top:10px;">' +
      '<table ' + TAB + ' style="background:' + T.hojeFundo + ';border:1px solid ' + T.hojeBorda + ';border-radius:8px;">' +
        '<tr><td style="padding:4px 12px 10px;"><table ' + TAB + '>' + linhas + '</table></td></tr>' +
      '</table></td></tr>';
  };

  // Contador do topo
  const stat = (rotulo, valor, cor) =>
    '<td align="center" style="padding:10px 4px;background:' + T.azulClaro + ';border-radius:6px;">' +
      '<div style="' + MONO + 'font-size:22px;font-weight:bold;color:' + (valor ? cor : T.niveis.longe.cor) + ';">' + pad2_(valor) + '</div>' +
      '<div style="font-size:10px;letter-spacing:1px;color:' + T.suave + ';">' + rotulo + '</div>' +
    '</td>';

  let h = '<div style="background:' + T.fundo + ';padding:28px 10px;' + SANS + '">' +
    '<table ' + TAB + ' align="center" style="max-width:640px;margin:0 auto;background:' + T.painel + ';border-radius:10px;border:1px solid ' + T.linha + ';' + SANS + '">' +

    // Cabeçalho azul-marinho
    '<tr><td style="background:' + T.marinho + ';padding:20px 24px;border-radius:10px 10px 0 0;">' +
      '<table ' + TAB + '><tr>' +
        '<td>' +
          '<div style="' + MONO + 'color:' + T.etiqueta + ';font-size:10px;letter-spacing:3px;">ISCTE · MESTRADO DE ENGENHARIA INFORMÁTICA</div>' +
          '<div style="color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:1px;margin-top:4px;">🤖 ' + escapar_(NOME_BOT) + ' ⏰</div>' +
          '<div style="color:' + T.subtitulo + ';font-size:13px;margin-top:2px;">' + escapar_(MENSAGEM_BOT) + '</div>' +
        '</td>' +
        '<td align="right" style="vertical-align:top;' + MONO + 'color:' + T.etiqueta + ';font-size:11px;white-space:nowrap;">' + dataLonga_(hoje) + '</td>' +
      '</tr></table>' +
    '</td></tr>' +
    '<tr><td style="height:4px;background:' + T.azul + ';font-size:1px;line-height:1px;">&nbsp;</td></tr>' +

    // Painel de contadores (mostra sempre os zeros, mesmo com secções escondidas)
    '<tr><td style="padding:18px 24px 0;">' +
      '<table ' + TAB + ' cellspacing="6"><tr>' +
        stat('Hoje', d.nHoje, T.niveis.critico.cor) +
        stat('Amanhã', d.nAmanha, T.niveis.alerta.cor) +
        stat('7 dias', d.n7, T.niveis.alerta.cor) +
        stat(limite + ' dias', d.n30, T.azul) +
        stat('Total', d.nTotal, T.marinho) +
      '</tr></table>' +
    '</td></tr>' +

    // Janelas de tempo
    '<tr><td style="padding:0 24px;"><table ' + TAB + '>' +
      d.janelas.map((j, k) => secao(j, k === 0 && DESTAQUE_HOJE)).join('') +
      (!d.n30 && !MOSTRAR_SECOES_VAZIAS
        ? '<tr><td style="padding:16px 0 4px;font-size:13px;color:' + T.suave + ';">Nada nos próximos ' + limite + ' dias.</td></tr>'
        : '') +
    '</table></td></tr>' +

    // Rodapé
    '<tr><td style="padding:22px 24px 24px;">' +
      '<a href="' + link + '" style="background:' + T.marinho + ';color:#ffffff;font-size:13px;font-weight:bold;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Abrir ficheiro-fonte →</a>' +
      '<div style="color:' + T.suave + ';font-size:11px;margin-top:14px;">Enviado automaticamente pelo ' + escapar_(NOME_BOT) + ' · Google Apps Script . Joel Monteiro</div>' +
    '</td></tr>' +
    '</table></div>';

  return h;
}

// ===== FORMATAÇÃO DO GOOGLE DOC =====

/**
 * Converte o parágrafo do Google Doc em HTML,
 * mantém negrito, itálico, sublinhado, rasurado, cor e links.
 * O texto do Doc está dividido em "pedaços" (runs) com formatação uniforme;
 * getTextAttributeIndices() diz onde começa cada um.
 * Os links levam {{LINK}} como cor, substituída depois pela cor do tema.
 */
function paragrafoParaHtml_(paragrafo, ini, fim) {
  const t = paragrafo.editAsText();
  const s = t.getText();
  if (!s) return '';

  const inicios = t.getTextAttributeIndices();
  let html = '';

  inicios.forEach((a, k) => {
    const b = k + 1 < inicios.length ? inicios[k + 1] : s.length;
    const de = Math.max(a, ini), ate = Math.min(b, fim);
    if (de >= ate) return; // pedaço fora do troço pedido

    let pedaco = escapar_(s.substring(de, ate));
    const url = t.getLinkUrl(a);
    const cor = corLegivel_(t.getForegroundColor(a));

    if (t.isBold(a)) pedaco = '<b>' + pedaco + '</b>';
    if (t.isItalic(a)) pedaco = '<i>' + pedaco + '</i>';
    if (t.isStrikethrough(a)) pedaco = '<s>' + pedaco + '</s>';
    if (t.isUnderline(a) && !url) pedaco = '<u>' + pedaco + '</u>'; // links já vêm sublinhados
    if (cor) pedaco = '<span style="color:' + cor + '">' + pedaco + '</span>';
    if (url) pedaco = '<a href="' + escapar_(url) + '" style="color:{{LINK}};">' + pedaco + '</a>';

    html += pedaco;
  });

  return html;
}

/**
 * O tema é claro: cores muito claras do Doc (ex.: branco ou amarelo-claro)
 * ficariam invisíveis no fundo branco, por isso são ignoradas e o texto
 * usa a cor do tema.
 * @param {?string} cor  ex.: "#ff0000"
 * @return {?string} a cor, ou null se for demasiado clara
 */
function corLegivel_(cor) {
  if (!cor || !/^#[0-9a-f]{6}$/i.test(cor)) return null;
  const c = [1, 3, 5].map(k => parseInt(cor.substr(k, 2), 16) / 255);
  const luz = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return luz > 0.75 ? null : cor;
}

// ===== AUXILIARES =====
const DIAS_SEMANA_ = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** 7 → "07" */
function pad2_(n) { return (n < 10 ? '0' : '') + n; }
/** Dias de a até b. O round absorve a hora de diferença da mudança de hora. */
function diasEntre_(a, b) { return Math.round((b - a) / 86400000); }
/** Tira as horas a uma data (meia-noite do mesmo dia). */
function semHoras_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

/** "sex 27/11" (com o ano só quando não é o ano de hoje). */
function dataCurta_(d, hoje) {
  return DIAS_SEMANA_[d.getDay()] + ' ' + pad2_(d.getDate()) + '/' + pad2_(d.getMonth() + 1) +
    (d.getFullYear() !== hoje.getFullYear() ? '/' + d.getFullYear() : '');
}
/** "sex, 27/11/2026". */
function dataLonga_(d) {
  return DIAS_SEMANA_[d.getDay()] + ', ' + pad2_(d.getDate()) + '/' + pad2_(d.getMonth() + 1) + '/' + d.getFullYear();
}

/** Escapa &, <, > e " para o texto não partir o HTML do email. */
function escapar_(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

