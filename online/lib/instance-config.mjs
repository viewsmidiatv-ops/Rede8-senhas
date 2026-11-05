export function validateInstance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuração do cliente inválida.');
  const text = (key, max) => { if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > max) throw new Error(`Campo inválido: ${key}`); return value[key].trim(); };
  const id = text('id', 60);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Identificador do cliente inválido.');
  for (const key of ['primaryColor', 'accentColor']) if (!/^#[0-9a-f]{6}$/i.test(value[key])) throw new Error(`Cor inválida: ${key}`);
  const names = value.counterNames;
  if (!Array.isArray(names) || names.length < 1 || names.length > 20 || names.some(n => typeof n !== 'string' || !n.trim() || n.length > 60) || new Set(names.map(n => n.trim().toLowerCase())).size !== names.length) throw new Error('Informe entre 1 e 20 guichês com nomes únicos.');
  const logoUrl = value.logoUrl || '';
  if (typeof logoUrl !== 'string' || logoUrl.length > 1000) throw new Error('URL de logomarca inválida.');
  if (logoUrl) { const url = new URL(logoUrl); if (url.protocol !== 'https:' || url.username || url.password) throw new Error('A logomarca deve usar uma URL HTTPS sem credenciais.'); }
  if (!value.voice || value.voice.language !== 'pt-BR' || typeof value.voice.rate !== 'number' || value.voice.rate < .6 || value.voice.rate > 1.4) throw new Error('Voz inválida; use pt-BR e velocidade entre 0.6 e 1.4.');
  if (!['classic', 'compact'].includes(value.displayLayout)) throw new Error('Layout inválido.');
  return {id,name:text('name',60),legalName:text('legalName',100),tagline:text('tagline',120),symbol:text('symbol',2),logoUrl,primaryColor:value.primaryColor,accentColor:value.accentColor,counterNames:names.map(n=>n.trim()),voice:{language:'pt-BR',rate:value.voice.rate},displayLayout:value.displayLayout};
}
