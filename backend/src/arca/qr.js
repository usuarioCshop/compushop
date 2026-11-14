function qrUrl({ fecha, cuit, ptoVta, tipoCmp, nroCmp, importe, tipoDocRec, nroDocRec, cae }) {
  const data = {
    ver: 1,
    fecha: String(fecha).slice(0, 10),
    cuit: Number(String(cuit).replace(/\D/g, '')),
    ptoVta: Number(ptoVta),
    tipoCmp: Number(tipoCmp),
    nroCmp: Number(nroCmp),
    importe: Number(importe),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: Number(tipoDocRec),
    nroDocRec: Number(tipoDocRec) === 99 ? 0 : Number(String(nroDocRec || 0).replace(/\D/g, '') || 0),
    tipoCodAut: 'E',
    codAut: Number(String(cae).replace(/\D/g, '')),
  };
  return 'https://www.afip.gob.ar/fe/qr/?p=' + Buffer.from(JSON.stringify(data)).toString('base64');
}

module.exports = { qrUrl };
