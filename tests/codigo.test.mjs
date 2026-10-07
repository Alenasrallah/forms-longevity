// Testes do apps-script/Codigo.gs, rodando o script de verdade num contexto
// com SpreadsheetApp, LockService, ContentService e MailApp simulados.
// Rodar a partir da pasta Sistema-Longevity:  node --test formulario/tests/codigo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CODIGO = readFileSync(new URL('../apps-script/Codigo.gs', import.meta.url), 'utf8');
const PAGINA = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function carregarScript() {
  const linhas = [];
  const emails = [];
  const intervalo = { setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; } };
  const aba = {
    getLastRow: () => linhas.length,
    appendRow: (linha) => { linhas.push(linha); },
    getRange: () => intervalo,
    setFrozenRows() {},
    setColumnWidth() {},
  };
  const planilha = { getSheetByName: () => aba, insertSheet: () => aba };
  const contexto = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => planilha, openById: () => planilha },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (texto) => ({ setMimeType() { return this; }, getContent: () => texto }),
    },
    MailApp: { sendEmail: (mensagem) => { emails.push(mensagem); } },
    console: { log() {}, error() {} },
  });
  vm.runInContext(CODIGO, contexto);
  return { contexto, linhas, emails };
}

function candidatura(extra = {}) {
  return {
    nome: 'Ana Souza', idade: '29', cidade: 'Pinheiros', whatsapp: '(11) 98888-7777',
    curso: 'Administração', instituicao: 'USP', ano_conclusao: '2019',
    empresa_atual: 'Clínica Vida', cargo_atual: 'Recepcionista', tempo_atual: '2 anos',
    exp1_empresa: 'Loja Centro', exp1_cargo: 'Vendedora', exp1_tempo: '1 ano',
    exp2_empresa: '', exp2_cargo: '', exp2_tempo: '',
    saude: 'Sim', saude_detalhe: 'Recepção de clínica', vendas: 'Sim', vendas_detalhe: 'Varejo',
    coordenacao: 'Não', coordenacao_detalhe: '',
    ferramentas: 'Excel ou Planilhas, CRM', ferramentas_outras: '',
    pretensao: 'R$ 3.500', inicio: 'Em 15 dias', motivacao: 'Gosto de cuidar do atendimento.',
    ...extra,
  };
}

function enviar(contexto, dados) {
  return JSON.parse(contexto.doPost({ postData: { contents: JSON.stringify(dados) } }).getContent());
}

test('grava o cabeçalho e uma linha com as respostas na ordem das colunas', () => {
  const { contexto, linhas } = carregarScript();

  const resposta = enviar(contexto, candidatura());

  assert.equal(resposta.ok, true);
  assert.equal(linhas.length, 2);
  const [cabecalho, linha] = linhas;
  assert.equal(cabecalho[0], 'Data/Hora');
  assert.equal(cabecalho.length, linha.length);
  assert.equal(Object.prototype.toString.call(linha[0]), '[object Date]');
  assert.equal(linha[cabecalho.indexOf('Nome completo')], 'Ana Souza');
  assert.equal(linha[cabecalho.indexOf('Ferramentas que usa bem')], 'Excel ou Planilhas, CRM');
  assert.equal(linha[cabecalho.indexOf('Experiência 2 · empresa')], '');
});

test('não repete o cabeçalho a partir do segundo envio', () => {
  const { contexto, linhas } = carregarScript();

  enviar(contexto, candidatura());
  enviar(contexto, candidatura({ nome: 'Bruno Lima' }));

  assert.equal(linhas.length, 3);
  assert.equal(linhas.filter((l) => l[0] === 'Data/Hora').length, 1);
});

test('honeypot preenchido responde ok e não grava nada', () => {
  const { contexto, linhas } = carregarScript();

  const resposta = enviar(contexto, candidatura({ empresa_fax: 'spam' }));

  assert.equal(resposta.ok, true);
  assert.equal(linhas.length, 0);
});

test('campo obrigatório em branco não grava e diz qual faltou', () => {
  const { contexto, linhas } = carregarScript();

  const resposta = enviar(contexto, candidatura({ nome: '   ', motivacao: '' }));

  assert.equal(resposta.ok, false);
  assert.match(resposta.erro, /Nome completo/);
  assert.match(resposta.erro, /Por que quer a vaga/);
  assert.equal(linhas.length, 0);
});

test('texto que começaria uma fórmula é gravado como texto puro', () => {
  const { contexto, linhas } = carregarScript();

  enviar(contexto, candidatura({ motivacao: '=IMPORTXML("http://x")', ferramentas_outras: '+55 sistema', exp2_empresa: '@empresa' }));

  const [cabecalho, linha] = linhas;
  assert.equal(linha[cabecalho.indexOf('Por que quer a vaga e o que traria')], "'=IMPORTXML(\"http://x\")");
  assert.equal(linha[cabecalho.indexOf('Outras ferramentas')], "'+55 sistema");
  assert.equal(linha[cabecalho.indexOf('Experiência 2 · empresa')], "'@empresa");
});

test('resposta longa é cortada no limite de caracteres', () => {
  const { contexto, linhas } = carregarScript();

  enviar(contexto, candidatura({ motivacao: 'a'.repeat(5000) }));

  const [cabecalho, linha] = linhas;
  assert.equal(linha[cabecalho.indexOf('Por que quer a vaga e o que traria')].length, contexto.LIMITE_CARACTERES);
});

test('corpo que não é JSON responde erro e não grava', () => {
  const { contexto, linhas } = carregarScript();

  const resposta = JSON.parse(contexto.doPost({ postData: { contents: 'isto não é json' } }).getContent());

  assert.equal(resposta.ok, false);
  assert.equal(linhas.length, 0);
});

test('avisa a equipe por e-mail com o conteúdo escapado', () => {
  const { contexto, emails } = carregarScript();
  contexto.AVISAR = ['rh@exemplo.com'];

  enviar(contexto, candidatura({ nome: '<b>Ana</b>' }));

  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'rh@exemplo.com');
  assert.match(emails[0].htmlBody, /&lt;b&gt;Ana&lt;\/b&gt;/);
});

test('sem destinatário em AVISAR, nenhum e-mail sai', () => {
  const { contexto, emails } = carregarScript();

  enviar(contexto, candidatura());

  assert.equal(emails.length, 0);
});

test('testarGravacao grava uma linha válida', () => {
  const { contexto, linhas } = carregarScript();

  contexto.testarGravacao();

  assert.equal(linhas.length, 2);
  assert.equal(linhas[1][1], 'Teste Longevity');
});

test('as colunas da planilha batem com os campos do formulário', () => {
  const { contexto } = carregarScript();
  const nomesNaPagina = new Set(
    [...PAGINA.matchAll(/<(?:input|textarea|select)\b[^>]*\bname="([a-z0-9_]+)"/g)].map((m) => m[1]),
  );
  nomesNaPagina.delete('empresa_fax');   // honeypot, não vira coluna
  nomesNaPagina.add('ferramentas');      // montado a partir dos chips no envio

  const chaves = contexto.CAMPOS.map((campo) => campo[0]);

  assert.deepEqual([...chaves].sort(), [...nomesNaPagina].sort());
});

test('os campos obrigatórios da planilha também são obrigatórios na página', () => {
  const { contexto } = carregarScript();
  // data-required-if (detalhe condicional) não conta: só vira obrigatório depois de um "Sim".
  const obrigatoriosNaPagina = new Set([
    ...[...PAGINA.matchAll(/<(?:input|textarea)\b[^>]*\bname="([a-z0-9_]+)"[^>]*\srequired[\s>]/g)].map((m) => m[1]),
    ...[...PAGINA.matchAll(/data-name="([a-z0-9_]+)"[^>]*data-required/g)].map((m) => m[1]),
  ]);

  const obrigatoriosNoScript = contexto.CAMPOS.filter((campo) => campo[2]).map((campo) => campo[0]);

  assert.deepEqual([...obrigatoriosNoScript].sort(), [...obrigatoriosNaPagina].sort());
});
