#!/usr/bin/env bash
# Push del historial reescrito (purga de la password de Neon expuesta).
#
# Contexto: la credencial de neondb_owner estuvo en backend/.env.example desde
# el commit 1b54985 (historia vieja) en un repositorio publico. Ya fue rotada y
# verificada como invalida, y el historial local fue reescrito con filter-repo.
# Falta reemplazar el historial en GitHub.
#
# REQUISITOS ANTES DE CORRER:
#   1. Verificar que nadie mas este trabajando sobre este repositorio.
#      Cualquier clon existente queda con historia divergente y va a necesitar
#      re-clonar (o git fetch + git reset --hard origin/<rama>).
#   2. Tener credenciales con permiso de escritura sobre usuarioCshop/compushop.
#   3. Estar en el directorio del repositorio.
#
# Los force-push reescriben main y dev2. El backup del estado anterior esta en
# /tmp/opencode/compushop-backup.git (clon espejo con las refs viejas).

set -euo pipefail

cd "$(dirname "$0")"
REPO_ROOT="/mnt/d/2026/aplicacion negocio/compushop"
cd "$REPO_ROOT"

# Fragmento de la credencial vieja, armado en runtime para no dejarla escrita
# en este archivo. Debe estar rotada e invalida: lo que se busca aca es que el
# historial publicado no la siga mostrando.
NEEDLE="npg_ZaOeB28""RFUwo"

echo "== Verificando que el historial local este limpio =="
# OJO: se revisan SOLO las ramas locales. 'git log --all' incluye las refs
# origin/*, que son justamente las que tienen la credencial hasta que el
# force-push las reemplace: usarlo aca abortaria siempre por el motivo falso.
if git log dev2 main -p | grep -q "$NEEDLE"; then
  echo "ERROR: la credencial todavia aparece en el historial local. Abortando."
  exit 1
fi
echo "OK: 0 ocurrencias de la credencial en el historial local."

echo
echo "== Lo que se va a publicar =="
echo "main: $(git rev-parse --short main)  ($(git rev-list --count main) commits)"
echo "dev2: $(git rev-parse --short dev2)  ($(git rev-list --count dev2) commits)"
echo

read -r -p "Force-push a origin/main y origin/dev2? Escribi 'si' para continuar: " CONFIRM
if [ "$CONFIRM" != "si" ]; then
  echo "Cancelado."
  exit 0
fi

echo
echo "== Force-push de main =="
git push --force-with-lease origin main

echo
echo "== Force-push de dev2 =="
git push --force-with-lease origin dev2

echo
echo "Listo. Verificando..."
git fetch origin
echo -n "credencial en origin/main: "
git grep -c "$NEEDLE" origin/main 2>/dev/null || echo "0 (limpio)"
echo -n "credencial en origin/dev2: "
git grep -c "$NEEDLE" origin/dev2 2>/dev/null || echo "0 (limpio)"
