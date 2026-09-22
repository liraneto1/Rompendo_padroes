const localHosts=new Set(['localhost','127.0.0.1']);
const publicHosts=new Set(['arquiteturadavida.com.br','www.arquiteturadavida.com.br']);

export function runtimeConfig(env=process.env){
  const production=env.NODE_ENV==='production';
  const rawPort=env.PORT||'4173';
  if(!/^\d+$/.test(rawPort)||Number(rawPort)<1||Number(rawPort)>65535)throw new Error('PORT deve ser um inteiro entre 1 e 65535.');
  return {production,port:Number(rawPort),bind:env.ROMPA_BIND_ADDRESS||(production?'0.0.0.0':'127.0.0.1')};
}

// Validate the actual Host header, never an untrusted forwarded host.
export function allowedHost(value){
  if(typeof value!=='string')return null;
  const match=/^([a-z0-9.-]+)(?::([0-9]{1,5}))?$/i.exec(value);
  if(!match||(match[2]&&(Number(match[2])<1||Number(match[2])>65535)))return null;
  const hostname=match[1].toLowerCase();
  if(!localHosts.has(hostname)&&!publicHosts.has(hostname))return null;
  return {authority:value.toLowerCase(),local:localHosts.has(hostname)};
}

export function allowedOrigin(origin,host,production=false){
  const accepted=allowedHost(host);
  if(!accepted||typeof origin!=='string')return false;
  const protocols=production&&!accepted.local?['https:']:['http:','https:'];
  // Exact origin match preserves port and same-host protection. No wildcard CORS.
  return protocols.some(protocol=>origin===new URL(`${protocol}//${accepted.authority}`).origin);
}
