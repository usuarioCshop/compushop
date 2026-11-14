const forge = require('node-forge');
const { XMLParser } = require('fast-xml-parser');
const db = require('../db/database');
const arcaConfig = require('../config/arca');

const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false });
const SERVICE = 'wsfe';

const arTime = (ms) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 19) + '-03:00';

function buildTRA() {
  const now = Date.now();
  return (
    '<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header>' +
    `<uniqueId>${Math.floor(now / 1000)}</uniqueId><generationTime>${arTime(now - 600e3)}</generationTime>` +
    `<expirationTime>${arTime(now + 600e3)}</expirationTime></header><service>${SERVICE}</service></loginTicketRequest>`
  );
}

function signCms(xml) {
  const certPem = arcaConfig.loadPem('ARCA_CERT_PEM', 'ARCA_CERT_PATH');
  const keyPem = arcaConfig.loadPem('ARCA_KEY_PEM', 'ARCA_KEY_PATH');
  if (!certPem || !keyPem) throw new Error('Faltan certificado y/o clave privada de ARCA');
  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(xml, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

async function getAuth() {
  const cached = await db.prepare(
    `SELECT token, sign FROM arca_tokens WHERE service = $1 AND expires_at > now() + interval '5 minutes'`
  ).get(SERVICE);
  if (cached && cached.token && cached.sign) return { token: cached.token, sign: cached.sign };

  const cms = signCms(buildTRA());
  const body =
    `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">` +
    `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;

  const res = await fetch(arcaConfig.urls.wsaa, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
    body,
  });
  const text = await res.text();
  const env = parser.parse(text).Envelope?.Body;
  if (env?.Fault) throw new Error(`WSAA: ${env.Fault.faultstring || JSON.stringify(env.Fault)}`);

  const ta = parser.parse(env.loginCmsResponse.loginCmsReturn).loginTicketResponse;
  const { token, sign } = ta.credentials;

  await db.prepare(
    `INSERT INTO arca_tokens (service, token, sign, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (service) DO UPDATE SET token = EXCLUDED.token, sign = EXCLUDED.sign, expires_at = EXCLUDED.expires_at, updated_at = now()`
  ).run(SERVICE, token, sign, ta.header.expirationTime);

  return { token, sign };
}

module.exports = { getAuth };
