const fs = require('fs');

const prod = process.env.ARCA_ENV === 'production';

function envVal(name, fallback = '') {
  const v = process.env[name];
  return v === undefined || v === null ? fallback : String(v).trim();
}

function loadPem(pemEnv, pathEnv) {
  const pem = process.env[pemEnv];
  if (pem) return String(pem).replace(/\\n/g, '\n');
  const p = envVal(pathEnv);
  if (!p) return '';
  return fs.readFileSync(p, 'utf8');
}

const urls = prod
  ? {
      wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
      wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
    }
  : {
      wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
      wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
    };

// Mapeo alícuota IVA (%) -> Id AFIP/ARCA
const IVA_IDS = { 0: 3, 2.5: 9, 5: 8, 10.5: 4, 21: 5, 27: 6 };
const TIPOS_CBTE = { 1: { letra: 'A', cod: '01', nombre: 'Factura A' }, 6: { letra: 'B', cod: '06', nombre: 'Factura B' } };

function getIssuerConfig(overrides = {}) {
  return {
    cuit: String(overrides.cuit || envVal('EMISOR_CUIT')).replace(/\D/g, ''),
    razonSocial: overrides.razonSocial || envVal('EMISOR_RAZON_SOCIAL'),
    domicilio: overrides.domicilio || envVal('EMISOR_DOMICILIO'),
    iibb: overrides.iibb || envVal('EMISOR_IIBB'),
    inicioAct: overrides.inicioAct || envVal('EMISOR_INICIO_ACT'),
    condicionIva: overrides.condicionIva || envVal('EMISOR_CONDICION_IVA'),
    ptoVta: Number(overrides.ptoVta || envVal('PTO_VTA', '1')) || 1,
  };
}

function hasArcaCredentials() {
  try {
    const cert = loadPem('ARCA_CERT_PEM', 'ARCA_CERT_PATH');
    const key = loadPem('ARCA_KEY_PEM', 'ARCA_KEY_PATH');
    return Boolean(cert && key);
  } catch (_e) {
    return false;
  }
}

module.exports = {
  isProduction: prod,
  env: prod ? 'production' : 'homologacion',
  urls,
  IVA_IDS,
  TIPOS_CBTE,
  loadPem,
  getIssuerConfig,
  hasArcaCredentials,
};
