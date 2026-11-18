#!/bin/sh
# Met un nouveau numéro de version dans index.html (force les navigateurs à recharger les fichiers)
D="${1:-docs}"; V=$(date +%Y%m%d%H%M%S)
sed -i -E "s/\?v=[A-Za-z0-9]+/?v=$V/g" "$D/index.html" && echo "version $V"
