/**
 * ============================================================
 * CANDIDATURAS · VAGA NA CLÍNICA
 * Instituto Longevity
 * ------------------------------------------------------------
 * Recebe o formulário de formulario/index.html e grava uma linha
 * por candidatura na planilha.
 * Passo a passo de instalação: ver LEIA-ME.md na pasta formulario.
 * ============================================================
 */

/* ---------- CONFIGURAÇÃO ---------- */

// ID da planilha de candidaturas (o trecho entre /d/ e /edit na URL do
// Google Sheets). Com ele preenchido, o script funciona tanto criado de
// dentro da planilha quanto como projeto separado em script.google.com.
var ID_PLANILHA = '1EOTolgwtMJWVCW5DDzk91XvXXjG2dY0_16PrqWP0ClQ';

// Aba onde as candidaturas são gravadas. Criada sozinha se não existir.
var ABA = 'Candidaturas';

// Avisar por e-mail a cada candidatura nova. Lista vazia = sem aviso.
var AVISAR = [];  // ex.: ['rh@suaclinica.com.br']

// Teto por resposta, para um envio malicioso não lotar a célula.
var LIMITE_CARACTERES = 2000;

// Uma entrada por coluna, na ordem da planilha:
// [nome do campo na página, título da coluna, obrigatório?]
var CAMPOS = [
  ['nome', 'Nome completo', true],
  ['idade', 'Idade', true],
  ['cidade', 'Bairro ou cidade', true],
  ['whatsapp', 'WhatsApp', true],
  ['curso', 'Curso', true],
  ['instituicao', 'Instituição', true],
  ['ano_conclusao', 'Ano de conclusão', true],
  ['empresa_atual', 'Empresa atual (ou última)', true],
  ['cargo_atual', 'Cargo atual (ou último)', true],
  ['tempo_atual', 'Tempo na empresa atual', true],
  ['exp1_empresa', 'Experiência 1 · empresa', true],
  ['exp1_cargo', 'Experiência 1 · cargo', true],
  ['exp1_tempo', 'Experiência 1 · tempo', true],
  ['exp2_empresa', 'Experiência 2 · empresa', false],
  ['exp2_cargo', 'Experiência 2 · cargo', false],
  ['exp2_tempo', 'Experiência 2 · tempo', false],
  ['saude', 'Já trabalhou em saúde ou clínica', true],
  ['saude_detalhe', 'Saúde · onde e fazendo o quê', false],
  ['vendas', 'Experiência com vendas', true],
  ['vendas_detalhe', 'Vendas · como foi', false],
  ['coordenacao', 'Já coordenou equipe', true],
  ['coordenacao_detalhe', 'Equipe · quantas pessoas e por quanto tempo', false],
  ['ferramentas', 'Ferramentas que usa bem', false],
  ['ferramentas_outras', 'Outras ferramentas', false],
  ['pretensao', 'Pretensão salarial', true],
  ['inicio', 'Quando pode começar', true],
  ['motivacao', 'Por que quer a vaga e o que traria', true]
];

/* ---------- ENTRADA HTTP ---------- */

function doPost(e) {
  var trava = LockService.getScriptLock();
  try {
    var dados = lerCorpo(e);

    // Honeypot: campo invisível na página. Se veio preenchido, é robô.
    // Respondemos ok para não dar pista ao script, mas não gravamos nada.
    if (dados.empresa_fax) return responder({ ok: true, ignorado: true });

    var faltando = camposFaltando(dados);
    if (faltando.length) {
      return responder({ ok: false, erro: 'Campos obrigatórios em branco: ' + faltando.join(', ') });
    }

    // Sem a trava, dois envios simultâneos podem gravar na mesma linha.
    trava.waitLock(20000);
    abaDeCandidaturas().appendRow(montarLinha(dados, new Date()));
    avisarEquipe(dados);
    return responder({ ok: true });

  } catch (erro) {
    return responder({ ok: false, erro: String(erro && erro.message || erro) });
  } finally {
    try { trava.releaseLock(); } catch (ignorado) {}
  }
}

// Abrir a URL /exec no navegador cai aqui. Serve só para conferir se a
// implantação está no ar.
function doGet() {
  return responder({ ok: true, servico: 'Candidaturas · Instituto Longevity' });
}

/* ---------- APOIO ---------- */

// A página envia JSON como text/plain para não disparar o preflight de CORS,
// mas aceitamos também form-urlencoded caso o envio venha de outro lugar.
function lerCorpo(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try {
      var json = JSON.parse(e.postData.contents);
      if (json && typeof json === 'object' && !Array.isArray(json)) return json;
    } catch (ignorado) {}
  }
  return e.parameter || {};
}

function camposFaltando(dados) {
  return CAMPOS
    .filter(function (campo) { return campo[2] && !limpar(dados[campo[0]]); })
    .map(function (campo) { return campo[1]; });
}

function montarLinha(dados, quando) {
  return [quando].concat(CAMPOS.map(function (campo) { return limpar(dados[campo[0]]); }));
}

// Corta no limite e neutraliza fórmulas: no Sheets, texto que começa com
// = + - @ vira fórmula. O apóstrofo na frente força texto puro.
function limpar(valor) {
  if (valor === null || valor === undefined) return '';
  var texto = String(valor).trim().slice(0, LIMITE_CARACTERES);
  if (/^[=+\-@]/.test(texto)) texto = "'" + texto;
  return texto;
}

function abaDeCandidaturas() {
  var planilha = ID_PLANILHA
    ? SpreadsheetApp.openById(ID_PLANILHA)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!planilha) throw new Error('Planilha não encontrada. Preencha ID_PLANILHA.');

  var aba = planilha.getSheetByName(ABA) || planilha.insertSheet(ABA);
  if (aba.getLastRow() === 0) {
    var cabecalho = ['Data/Hora'].concat(CAMPOS.map(function (campo) { return campo[1]; }));
    aba.appendRow(cabecalho);
    aba.getRange(1, 1, 1, cabecalho.length)
       .setFontWeight('bold')
       .setBackground('#050505')
       .setFontColor('#f5f5f3');
    aba.setFrozenRows(1);
    aba.setColumnWidth(1, 150);
    aba.setColumnWidth(2, 220);
    aba.setColumnWidth(cabecalho.length, 420);
  }
  return aba;
}

function avisarEquipe(dados) {
  if (!AVISAR.length) return;
  try {
    MailApp.sendEmail({
      to: AVISAR.join(','),
      subject: 'Nova candidatura · Instituto Longevity',
      htmlBody:
        '<p><strong>Nome:</strong> ' + escapar(limpar(dados.nome)) + '<br>' +
        '<strong>WhatsApp:</strong> ' + escapar(limpar(dados.whatsapp)) + '<br>' +
        '<strong>Bairro ou cidade:</strong> ' + escapar(limpar(dados.cidade)) + '<br>' +
        '<strong>Pretensão:</strong> ' + escapar(limpar(dados.pretensao)) + '</p>' +
        '<p>A candidatura completa está na aba ' + ABA + ' da planilha.</p>'
    });
  } catch (erro) {
    // Falha no aviso não pode derrubar a gravação da candidatura.
    console.error('Falha ao enviar aviso: ' + erro);
  }
}

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function responder(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- TESTE MANUAL ---------- */

// Rode esta função uma vez pelo editor para autorizar o script e conferir
// se a linha aparece na planilha. Apague a linha de teste depois.
function testarGravacao() {
  var resposta = doPost({
    postData: {
      contents: JSON.stringify({
        nome: 'Teste Longevity', idade: '30', cidade: 'Pinheiros', whatsapp: '(11) 90000-0000',
        curso: 'Administração', instituicao: 'Teste', ano_conclusao: '2020',
        empresa_atual: 'Teste', cargo_atual: 'Teste', tempo_atual: '1 ano',
        exp1_empresa: 'Teste', exp1_cargo: 'Teste', exp1_tempo: '1 ano',
        saude: 'Não', vendas: 'Não', coordenacao: 'Não',
        ferramentas: 'Excel ou Planilhas', pretensao: 'R$ 1', inicio: 'Imediato',
        motivacao: 'Linha de teste, pode apagar.'
      })
    }
  });
  console.log(resposta.getContent());
}

/* ---------- VISUAL DA PLANILHA ---------- */

// Rode esta função pelo editor para (re)aplicar o visual na aba Candidaturas.
// Pode rodar quantas vezes quiser: não apaga nenhuma resposta.
function formatarPlanilha() {
  var planilha = ID_PLANILHA
    ? SpreadsheetApp.openById(ID_PLANILHA)
    : SpreadsheetApp.getActiveSpreadsheet();

  var aba = planilha.getSheetByName(ABA);
  if (!aba) {
    var primeira = planilha.getSheets()[0];
    if (primeira.getLastRow() === 0) { primeira.setName(ABA); aba = primeira; }
    else aba = planilha.insertSheet(ABA);
  }

  var cabecalho = ['Data/Hora'].concat(CAMPOS.map(function (c) { return c[1]; }));
  var n = cabecalho.length;

  // Cabeçalho (só escreve se a linha 1 estiver vazia)
  if (aba.getLastRow() === 0 || !aba.getRange(1, 1).getValue()) {
    aba.getRange(1, 1, 1, n).setValues([cabecalho]);
  }

  // Remove colunas sobrando à direita
  if (aba.getMaxColumns() > n) aba.deleteColumns(n + 1, aba.getMaxColumns() - n);

  var todas = aba.getRange(1, 1, aba.getMaxRows(), n);
  todas.setFontFamily('Inter').setFontSize(10).setFontColor('#0a0a0b')
       .setVerticalAlignment('top').setHorizontalAlignment('left')
       .setWrap(true);

  // Cabeçalho
  aba.getRange(1, 1, 1, n)
     .setBackground('#0a0a0b').setFontColor('#f6f6f4').setFontWeight('bold')
     .setFontSize(10).setVerticalAlignment('middle').setWrap(true);
  aba.setRowHeight(1, 48);
  aba.setFrozenRows(1);
  aba.setFrozenColumns(2);
  aba.setHiddenGridlines(true);
  aba.setTabColor('#0a0a0b');

  // Linhas alternadas
  aba.getBandings().forEach(function (b) { b.remove(); });
  aba.getRange(1, 1, aba.getMaxRows(), n)
     .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
     .setHeaderRowColor('#0a0a0b').setFirstRowColor('#ffffff').setSecondRowColor('#f6f6f4');

  // Larguras
  var larguras = [140, 210, 60, 150, 130, 170, 170, 90, 170, 170, 120,
                  170, 170, 110, 170, 170, 110, 110, 220, 110, 220, 110, 220,
                  220, 180, 140, 140, 420];
  larguras.slice(0, n).forEach(function (w, i) { aba.setColumnWidth(i + 1, w); });

  // Formatos
  aba.getRange(2, 1, aba.getMaxRows() - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  aba.getRange(2, 3, aba.getMaxRows() - 1, 1).setHorizontalAlignment('center'); // idade
  aba.getRange(2, 8, aba.getMaxRows() - 1, 1).setHorizontalAlignment('center'); // ano
  aba.getRange(2, 2, aba.getMaxRows() - 1, 1).setFontWeight('bold');            // nome

  // Sim / Não com cor
  [18, 20, 22].forEach(function (col) {
    var faixa = aba.getRange(2, col, aba.getMaxRows() - 1, 1);
    faixa.setHorizontalAlignment('center').setFontWeight('bold');
  });
  var regras = aba.getConditionalFormatRules().filter(function () { return false; });
  [18, 20, 22].forEach(function (col) {
    var faixa = aba.getRange(2, col, aba.getMaxRows() - 1, 1);
    regras.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Sim').setBackground('#dff3e6').setFontColor('#1f9d55').setRanges([faixa]).build());
    regras.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Não').setBackground('#eeeeec').setFontColor('#55555a').setRanges([faixa]).build());
  });
  aba.setConditionalFormatRules(regras);

  // Bordas finas e filtro
  aba.getRange(1, 1, aba.getMaxRows(), n)
     .setBorder(null, null, null, null, true, true, '#dcdcda', SpreadsheetApp.BorderStyle.SOLID);
  if (aba.getFilter()) aba.getFilter().remove();
  aba.getRange(1, 1, Math.max(aba.getLastRow(), 2), n).createFilter();
}
