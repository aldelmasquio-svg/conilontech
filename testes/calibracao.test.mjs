// node testes/calibracao.test.mjs  — roda as funções REAIS de calibracao.html com um document falso
import fs from 'fs'; import assert from 'assert/strict';
const html = fs.readFileSync(new URL('../calibracao.html', import.meta.url), 'utf8');
const pegar = n => { const i = html.indexOf('function '+n+'('); let d=0, j=html.indexOf('{', i);
  for (let k=j; k<html.length; k++){ if(html[k]=='{')d++; else if(html[k]=='}'){ d--; if(!d) return html.slice(i,k+1);} } };
const campos = {}; globalThis.document = { getElementById: id => id in campos ? {value: campos[id]} : null };
const src = ['num','parseTempo','vazaoMedida','velocidadeKmh','calcAspersao','calcDrench'].map(pegar).join('\n');
const F = new Function(src + '; return {num,parseTempo,calcAspersao,calcDrench};')();
const set = o => { for (const k in campos) delete campos[k]; Object.assign(campos, o); };
const perto = (a,b,tol,msg) => assert.ok(Math.abs(a-b)<=tol, `${msg}: obtido ${a}, esperado ${b}`);
let falhas=0; const caso=(nome,fn)=>{ try{ fn(); console.log('✅', nome);}catch(e){ falhas++; console.log('❌', nome, '→', e.message);} };

caso('velocidade 113 m / 91 s = 4,47 km/h', ()=>{ set({distancia:'113', t1:'91'}); perto(F.calcAspersao().v, 4.47, 0.01, 'v'); });
caso('tempo "1:31" = 91 s', ()=>assert.equal(F.parseTempo('1:31'), 91));
caso('média de 3 tempos', ()=>{ set({distancia:'113', t1:'90', t2:'91', t3:'92'}); perto(F.calcAspersao().tMed, 91, 1e-9, 'tMed'); });
caso('vírgula decimal "1,5" e ponto "1.5"', ()=>{ set({x:'1,5', y:'1.5'}); assert.equal(F.num('x'), 1.5); assert.equal(F.num('y'), 1.5); });
caso('L/ha = vazãoTotal·600/(v·largura)', ()=>{
  set({distancia:'113', t1:'91', medL0:'1,2', medT0:'60', numBicos:'3', largura:'2', tanque:'2000'});
  const c=F.calcAspersao(); perto(c.lha, 3.6*600/(4.4703*2), 0.5, 'lha'); perto(c.haTanque, 2000/c.lha, 1e-9, 'ha/tanque'); perto(c.autonomiaMin, 2000/3.6, 1e-6, 'autonomia'); });
caso('drench: L/m = vazão ÷ v(m/min)', ()=>{ set({distancia:'113', t1:'91', vazaoDrench:'20', espPlantas:'1', tanque:'2000'}); const c=F.calcDrench(); perto(c.lMetro, 20/(4.4703*1000/60), 1e-3, 'L/m'); });
caso('tanque digitado "2.000" (milhar) deve ser 2000 L', ()=>{ set({tanque:'2.000'}); assert.equal(F.num('tanque'), 2000); });
caso('valor "1.234,5" deve ser 1234,5', ()=>{ set({x:'1.234,5'}); assert.equal(F.num('x'), 1234.5); });
caso('distância negativa não deve gerar resultado', ()=>{ set({distancia:'-113', t1:'91'}); assert.ok(!(F.calcAspersao().v < 0), 'velocidade negativa: '+F.calcAspersao().v); });
console.log(falhas? `\n${falhas} falha(s)` : '\nTudo verde'); process.exit(falhas?1:0);
