export const PAGE_SIZE = 20;

export const DEFAULT_STATUSES = ['pendiente', 'en_proceso', 'reparado', 'entregado', 'cancelado'];

export const ACTIVE_REPAIR_STATUSES = ['pendiente', 'en_proceso', 'reparado'];

export const emptyForm = {
  ticket_number: '',
  status: 'pendiente',
  client_name: '',
  client_address: '',
  client_id: '',
  client_email: '',
  client_phone: '',
  article: '',
  brand: '',
  model: '',
  serial_number: '',
  damage_reported: '',
  notes: '',
  image_url: '',
  probable_repair_date: '',
  assigned_to: '',
};

export const statusLabel = (name) => {
  if (!name) return '';
  return name.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
};

export const statusColor = (status) => {
  const map = {
    pendiente: 'yellow',
    en_proceso: 'blue',
    reparado: 'green',
    entregado: 'teal',
    cancelado: 'red',
  };
  return map[status] || 'gray';
};

export const formatDateTime = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateOnly = (iso) => {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-AR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const formatCurrency = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return number.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  });
};

export const toDateInput = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

export const toDateTimeInput = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const validateForm = (values) => {
  if (!values.client_name.trim() || values.client_name.trim().length < 2) {
    return 'El nombre del cliente debe tener al menos 2 caracteres';
  }
  if (!values.damage_reported.trim() || values.damage_reported.trim().length < 3) {
    return 'El daño reportado debe tener al menos 3 caracteres';
  }
  if (values.client_email.trim() && !isEmail(values.client_email.trim())) {
    return 'El email del cliente no es válido';
  }
  return null;
};

export function buildFilterParams({
  search,
  status,
  receivedFrom,
  receivedTo,
  probableFrom,
  probableTo,
  sortBy,
  sortDir,
}) {
  const q = new URLSearchParams();
  if (search) q.set('search', search);
  if (status) q.set('status', status);
  if (receivedFrom) q.set('received_from', receivedFrom);
  if (receivedTo) q.set('received_to', receivedTo);
  if (probableFrom) q.set('probable_from', probableFrom);
  if (probableTo) q.set('probable_to', probableTo);
  q.set('sort_by', sortBy);
  q.set('sort_dir', sortDir);
  return q;
}

// Descarga un blob con el nombre que manda el backend en Content-Disposition.
export function downloadBlob(response, fallbackName) {
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : fallbackName;

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
