/**
 * Alertas de datas de entrega — Google Apps Script
 *
 * Lê um ficheiro de texto do Google Drive (Google Doc ou .txt) e, quando
 * uma data se aproxima, envia um email para ti e para os colegas com quem
 * o ficheiro está partilhado.
 *
 * Se o ficheiro for um Google Doc, o email mantém a formatação de cada linha
 * (negrito, itálico, sublinhado, rasurado, cor e links).
 *
 * Formato esperado: uma data por linha, em qualquer posição da linha, ex.:
 *   15/11 - Teste de ML
 *   Entrega SRSI DNS Spoofing: 03/12/2026
 *   20-01-27 Exame Redes
 * (O ano é opcional. Se faltar, assume o próximo dia/mês que ainda vem.)
 */

// ===== CONFIGURAÇÃO =====
const FILE_ID = '1syQ5PpS2ZtEXLHIu7Y2lRed7sCww6GmxHVS_wY-rcj0'; // parte do URL entre /d/ e /edit
const DIAS_AVISO = [14, 7, 3, 1, 0];   // avisa quando faltarem exatamente estes dias
const JANELA_RESUMO = 21;          // o email lista também tudo o que vem nos próximos N dias
const INCLUIR_PARTILHADOS = true;  // envia também para quem tem acesso de edição ao ficheiro
const EMAILS_EXTRA = [];           // ex.: ['colega@iscte-iul.pt']
const HORA_DO_EMAIL = 8;           // hora aproximada do envio diário

// ===== FUNÇÃO PRINCIPAL (corre todos os dias) =====
function verificarDatas(forcar) {
  const hoje = semHoras_(new Date());
  const itens = lerDatas_(hoje);

  const urgentes = itens.filter(i => DIAS_AVISO.includes(i.faltam));
  if (urgentes.length === 0 && forcar !== true) return; // nada a avisar hoje

  const proximos = itens.filter(i => i.faltam <= JANELA_RESUMO);

  // O assunto de um email não aceita formatação, por isso fica em texto simples
  const assunto = urgentes.length
    ? '⏰ ' + urgentes.map(i => rotulo_(i.faltam) + ': ' + i.texto).join(' | ')
    : '📅 Próximas datas (teste)';

  const link = 'https://drive.google.com/open?id=' + FILE_ID;

  // Versão em texto simples (para clientes de email que não mostram HTML)
  let corpo = 'Datas nos próximos ' + JANELA_RESUMO + ' dias:\n\n';
  corpo += proximos.length
    ? proximos.map(i => '• ' + rotulo_(i.faltam) + ' — ' + i.texto).join('\n')
    : '(nenhuma)';
  corpo += '\n\nFicheiro: ' + link;

  // Versão formatada (HTML), com a formatação original do Google Doc
  let html = '<p>Datas nos próximos ' + JANELA_RESUMO + ' dias:</p>';
  html += proximos.length
    ? '<ul>' + proximos.map(i =>
        '<li><b>' + rotulo_(i.faltam) + '</b> — ' + i.html + '</li>').join('') + '</ul>'
    : '<p>(nenhuma)</p>';
  html += '<p>Ficheiro: <a href="' + link + '">abrir no Google Drive</a></p>';

  MailApp.sendEmail(destinatarios_().join(','), assunto.slice(0, 250), corpo, { htmlBody: html });
}

// Envia já um email com a lista, mesmo sem datas "de aviso" hoje — para testar.
function testar() {
  verificarDatas(true);
}

// Corre UMA vez para o script passar a correr sozinho todos os dias.
function criarAcionador() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'verificarDatas')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('verificarDatas')
    .timeBased().everyDays(1).atHour(HORA_DO_EMAIL).create();
}

// ===== AUXILIARES =====

// Devolve as linhas do ficheiro, cada uma em texto simples e em HTML
function lerLinhas_() {
  const ficheiro = DriveApp.getFileById(FILE_ID);

  if (ficheiro.getMimeType() === MimeType.GOOGLE_DOCS) {
    // Google Doc: cada parágrafo (inclui itens de lista e texto em tabelas) é uma linha
    return DocumentApp.openById(FILE_ID).getBody().getParagraphs()
      .map(p => ({ texto: p.getText(), html: paragrafoParaHtml_(p) }));
  }

  // .txt: não tem formatação, por isso o HTML é só o texto escapado
  return ficheiro.getBlob().getDataAsString().split(/\r?\n/)
    .map(l => ({ texto: l, html: escapar_(l) }));
}

// Converte um parágrafo do Google Doc em HTML, mantendo a formatação.
// O texto está dividido em "pedaços" (runs): cada pedaço tem a mesma formatação do início ao fim.
function paragrafoParaHtml_(paragrafo) {
  const t = paragrafo.editAsText();
  const s = t.getText();
  if (!s) return '';

  const inicios = t.getTextAttributeIndices(); // onde começa cada pedaço
  let html = '';

  inicios.forEach((ini, k) => {
    const fim = k + 1 < inicios.length ? inicios[k + 1] : s.length;
    let pedaco = escapar_(s.substring(ini, fim));
    if (!pedaco) return;

    const url = t.getLinkUrl(ini);
    const cor = t.getForegroundColor(ini);

    if (t.isBold(ini)) pedaco = '<b>' + pedaco + '</b>';
    if (t.isItalic(ini)) pedaco = '<i>' + pedaco + '</i>';
    if (t.isStrikethrough(ini)) pedaco = '<s>' + pedaco + '</s>';
    if (t.isUnderline(ini) && !url) pedaco = '<u>' + pedaco + '</u>'; // links já vêm sublinhados
    if (cor) pedaco = '<span style="color:' + cor + '">' + pedaco + '</span>';
    if (url) pedaco = '<a href="' + escapar_(url) + '">' + pedaco + '</a>';

    html += pedaco;
  });

  return html;
}

function lerDatas_(hoje) {
  const itens = [];
  lerLinhas_().forEach(linha => {
    const m = linha.texto.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
    if (!m) return;
    const dia = +m[1], mes = +m[2] - 1;
    if (mes < 0 || mes > 11 || dia < 1 || dia > 31) return;

    let ano = m[3] ? +m[3] : hoje.getFullYear();
    if (ano < 100) ano += 2000;
    let data = new Date(ano, mes, dia);
    if (!m[3] && data < hoje) data = new Date(ano + 1, mes, dia); // sem ano e já passou → próximo ano

    const faltam = Math.round((data - hoje) / 86400000);
    if (faltam < 0) return; // já passou
    itens.push({ data: data, faltam: faltam, texto: linha.texto.trim(), html: linha.html });
  });
  return itens.sort((a, b) => a.faltam - b.faltam);
}

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

// Evita que caracteres como < ou & partam o HTML do email
function escapar_(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function semHoras_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function rotulo_(n) {
  return n === 0 ? 'HOJE' : n === 1 ? 'AMANHÃ' : 'Faltam ' + n + ' dias';
}

function formatar_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}
