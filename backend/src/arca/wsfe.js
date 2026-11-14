const { XMLParser } = require('fast-xml-parser');
const { getAuth } = require('./wsaa');
const arcaConfig = require('../config/arca');

const NS = 'http://ar.gov.afip.dif.FEV1/';
const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false });
const arr = (v) => (v == null ? [] : [].concat(v));
const ymd = (d) => String(d).replaceAll('-', '');

async function call(method, inner, issuerCuit, runner) {
  const { token, sign } = await getAuth(runner);
  const cuit = String(issuerCuit || arcaConfig.getIssuerConfig().cuit).replace(/\D/g, '');
  if (!cuit) throw new Error('Falta CUIT del emisor para ARCA');
  const body =
    `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body><${method} xmlns="${NS}">` +
    `<Auth><Token>${token}</Token><Sign>${sign}</Sign><Cuit>${cuit}</Cuit></Auth>${inner}</${method}></soap:Body></soap:Envelope>`;
  const res = await fetch(arcaConfig.urls.wsfe, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `${NS}${method}` },
    body,
  });
  const text = await res.text();
  const env = parser.parse(text).Envelope?.Body;
  if (env?.Fault) throw new Error(`WSFE: ${env.Fault.faultstring || JSON.stringify(env.Fault)}`);
  return env[`${method}Response`][`${method}Result`];
}

const errs = (r) => arr(r?.Errors?.Err).map((e) => `${e.Code}: ${e.Msg}`);

async function ultimoAutorizado(ptoVta, cbteTipo, issuerCuit, runner) {
  const r = await call(
    'FECompUltimoAutorizado',
    `<PtoVta>${ptoVta}</PtoVta><CbteTipo>${cbteTipo}</CbteTipo>`,
    issuerCuit,
    runner
  );
  const errors = errs(r);
  if (errors.length) throw new Error(errors.join(' | '));
  return Number(r.CbteNro || 0);
}

/**
 * Solicita CAE.
 * d = { tipo, numero, fecha (YYYY-MM-DD), concepto, ptoVta, receptor: {docTipo,docNro,condIva,name,address}, totals: {neto,ivaTotal,total,iva:[{id,base,amount}]}, servicio? }
 */
async function solicitarCAE(d, issuerCuit, runner) {
  const { receptor: rc, totals: t } = d;
  const concepto = Number(d.concepto || 1);
  const serv =
    concepto !== 1 && d.servicio
      ? `<FchServDesde>${ymd(d.servicio.desde)}</FchServDesde><FchServHasta>${ymd(d.servicio.hasta)}</FchServHasta><FchVtoPago>${ymd(d.servicio.vtoPago)}</FchVtoPago>`
      : '';
  const iva = (t.iva || [])
    .map(
      (a) =>
        `<AlicIva><Id>${a.id}</Id><BaseImp>${Number(a.base).toFixed(2)}</BaseImp><Importe>${Number(a.amount).toFixed(2)}</Importe></AlicIva>`
    )
    .join('');
  const ptoVta = Number(d.ptoVta);
  const inner =
    `<FeCAEReq><FeCabReq><CantReg>1</CantReg><PtoVta>${ptoVta}</PtoVta><CbteTipo>${d.tipo}</CbteTipo></FeCabReq>` +
    `<FeDetReq><FECAEDetRequest>` +
    `<Concepto>${concepto}</Concepto><DocTipo>${rc.docTipo}</DocTipo><DocNro>${rc.docNro}</DocNro>` +
    `<CbteDesde>${d.numero}</CbteDesde><CbteHasta>${d.numero}</CbteHasta><CbteFch>${ymd(d.fecha)}</CbteFch>${serv}` +
    `<ImpTotal>${Number(t.total).toFixed(2)}</ImpTotal><ImpTotConc>0.00</ImpTotConc><ImpNeto>${Number(t.neto).toFixed(2)}</ImpNeto>` +
    `<ImpOpEx>0.00</ImpOpEx><ImpTrib>0.00</ImpTrib><ImpIVA>${Number(t.ivaTotal).toFixed(2)}</ImpIVA>` +
    `<MonId>PES</MonId><MonCotiz>1</MonCotiz><CondicionIVAReceptorId>${rc.condIva}</CondicionIVAReceptorId>` +
    `<Iva>${iva}</Iva></FECAEDetRequest></FeDetReq></FeCAEReq>`;

  const r = await call('FECAESolicitar', inner, issuerCuit, runner);
  const det = arr(r?.FeDetResp?.FECAEDetResponse)[0] || {};
  const messages = [...errs(r), ...arr(det.Observaciones?.Obs).map((o) => `${o.Code}: ${o.Msg}`)];
  const approved = r?.FeCabResp?.Resultado === 'A' && !!det.CAE;
  return {
    approved,
    messages,
    cae: det.CAE || null,
    caeVto: det.CAEFchVto
      ? `${det.CAEFchVto.slice(0, 4)}-${det.CAEFchVto.slice(4, 6)}-${det.CAEFchVto.slice(6, 8)}`
      : null,
    raw: { cab: r?.FeCabResp, det },
  };
}

module.exports = { ultimoAutorizado, solicitarCAE };
