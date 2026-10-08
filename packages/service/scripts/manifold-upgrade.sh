#!/bin/sh
# ---
# relationships:
#   implements: service-distribution
# ---
set -eu
# Resolve the archive before changing to the script's install directory.
command=${1-}
if [ "$command" = prepare ]; then
  [ "$#" = 2 ] || { echo 'Usage: manifold-upgrade.sh prepare <archive> | swap | rollback' >&2; exit 2; }
  case $2 in
    /*) archive=$2 ;;
    *) archive=$PWD/$2 ;;
  esac
elif [ "$#" != 1 ] || { [ "$command" != swap ] && [ "$command" != rollback ]; }; then
  echo 'Usage: manifold-upgrade.sh prepare <archive> | swap | rollback' >&2
  exit 2
fi
cd -- "$(dirname -- "$0")"
current=manifold-service
previous=manifold-service.previous
next=manifold-service.next
staging=manifold-service.staging
discard=manifold-service.discard
rm -rf -- "$staging" "$discard"
discard_tree() {
  rm -rf -- "$discard"
  if [ -d "$1" ]; then
    mv -- "$1" "$discard"
    rm -rf -- "$discard"
  fi
}
equal_trees() {
  find "$current" -printf '%P\t%y\t%m\t%l\n' | LC_ALL=C sort > "$staging/current.list"
  find "$next" -printf '%P\t%y\t%m\t%l\n' | LC_ALL=C sort > "$staging/next.list"
  cmp -s "$staging/current.list" "$staging/next.list" &&
    diff -r -q --no-dereference "$current" "$next" >/dev/null
}
case $command in
  prepare)
    mkdir -- "$staging"
    tar -xzf "$archive" -C "$staging"
    discard_tree "$next"
    mv -- "$staging/manifold-service" "$next"
    if [ -d "$current" ] && equal_trees; then
      discard_tree "$next"
      echo 'Archive is already the current install.'
    fi
    rm -rf -- "$staging"
    ;;
  swap)
    if [ ! -d "$next" ]; then
      echo 'Nothing is prepared.'
    else
      if [ -d "$current" ]; then
        discard_tree "$previous"
        mv -- "$current" "$previous"
      fi
      mv -- "$next" "$current"
    fi
    ;;
  rollback)
    if [ -d "$current" ] && [ -d "$next" ]; then
      echo 'Swap has not replaced the current install.'
    elif [ -d "$previous" ]; then
      discard_tree "$next"
      discard_tree "$current"
      mv -- "$previous" "$current"
    else
      echo 'There is no previous install.'
    fi
    ;;
esac
echo "$command complete."
