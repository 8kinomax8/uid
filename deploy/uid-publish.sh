#!/usr/bin/env bash
# Run inside the SSH chroot: Bash + POSIX utilities only. No Node, npm or Git.
set -euo pipefail
umask 077
fail() { printf '%s\n' "$*" >&2; exit 1; }
config=${1:?Usage: uid-publish.sh CONFIG check|publish|rollback|recover [RELEASE COMMIT FIRST]}
mode=${2:?Missing operation}
[[ "$config" == /private/uid-dev/server.env ]] || fail 'Only the private SSH-chroot configuration is permitted'
[[ -f "$config" && ! -L "$config" ]] || fail 'Missing regular server configuration'
# Validate the physical parent before sourcing operator-owned configuration.
[[ $(cd -- "$(dirname -- "$config")" && pwd -P) == /private/uid-dev ]] || fail 'Configuration directory resolves outside private DEV'
# This is an operator-installed private file, never an uploaded build artifact.
source "$config"
[[ ${UID_TARGET_HOST:-} == dev.fanfareuid.ch ]] || fail 'Only dev.fanfareuid.ch is permitted'
canonical() { [[ "$1" == /* && -d "$1" ]] || fail 'Existing absolute directory required'; (cd -- "$1" && pwd -P); }
[[ ${UID_DOCUMENT_ROOT:-} == /dev.fanfareuid.ch ]] || fail 'Only the verified DEV document root is permitted'
[[ ${UID_PRIVATE_DIR:-} == /private/uid-dev ]] || fail 'Only the verified private DEV directory is permitted'
root=$(canonical "${UID_DOCUMENT_ROOT:?}")
[[ "$root" == "$UID_DOCUMENT_ROOT" ]] || fail 'DEV root resolves to another location'
private=$(canonical "${UID_PRIVATE_DIR:?}")
[[ "$root" != / && "$private" != / ]] || fail 'Filesystem root forbidden'
disjoint() { [[ "$1" != "$2" && "$1/" != "$2/"* && "$2/" != "$1/"* ]]; }
[[ "$private" == "$UID_PRIVATE_DIR" ]] && disjoint "$private" "$root" || fail 'Private deployment directory overlaps a public root'
[[ "$config" == "$private/"* ]] || fail 'Server configuration must be in the private DEV directory'
[[ -f "$root/.uid-dev-target" && ! -L "$root/.uid-dev-target" && $(cat "$root/.uid-dev-target") == dev.fanfareuid.ch ]] || fail 'DEV root attestation missing'
[[ -d "$private/incoming" && ! -L "$private/incoming" && -d "$private/releases" && ! -L "$private/releases" && -d "$private/state" && ! -L "$private/state" ]] || fail 'Prepare incoming, releases and state directories first'
if command -v sha256sum >/dev/null; then hash() { sha256sum "$1" | cut -d ' ' -f 1; }
elif command -v shasum >/dev/null; then hash() { shasum -a 256 "$1" | cut -d ' ' -f 1; }
else fail 'sha256sum or shasum is required'; fi
valid_rel() {
 local value=$1 part lower
 [[ -n "$value" && "$value" != /* && "$value" != *\\* && "$value" != *//* && "$value" != *[[:cntrl:]]* ]] || return 1
 local -a parts
 IFS=/ read -r -a parts <<< "$value"
 for part in "${parts[@]}"; do
  lower=$(printf '%s' "$part" | tr '[:upper:]' '[:lower:]')
  case "$lower" in ''|.*|wordpress|node_modules|src|deploy) return 1;; esac
 done
 lower=$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')
 case "$lower" in *.php|*.php[0-9]|*.phtml|*.phar|*.env|*.map|*.sh|*.mjs|*.ts) return 1;; esac
}
check_target() {
 local rel=$1 part current=$root
 valid_rel "$rel" || fail 'Forbidden managed path'
 local -a parts
 IFS=/ read -r -a parts <<< "$rel"
 for part in "${parts[@]}"; do
  current="$current/$part"
  [[ ! -L "$current" ]] || fail 'Symlink in publication destination'
 done
 [[ ! -e "$current" || -f "$current" ]] || fail 'Nonregular publication destination'
}
lookup() { awk -F '\t' -v name="$2" '$2 == name {print $1; exit}' "$1"; }
validate_manifest() {
 local manifest=$1 sha rel extra
 [[ -f "$manifest" && ! -L "$manifest" && -s "$manifest" ]] || fail 'Missing manifest'
 while IFS=$'\t' read -r sha rel extra; do
  [[ "$sha" =~ ^[a-f0-9]{64}$ && -z "$extra" ]] && valid_rel "$rel" || fail 'Invalid manifest entry'
 done < "$manifest"
 awk -F '\t' 'seen[$2]++ {exit 1}' "$manifest" || fail 'Duplicate manifest path'
}
copy_atomic() {
 local source=$1 target=$2 temp
 mkdir -p -- "$(dirname -- "$target")"
 temp=$(mktemp "$(dirname -- "$target")/.uid-copy.XXXXXX")
 cp -- "$source" "$temp"
 chmod 644 "$temp"
 mv -f -- "$temp" "$target"
}
state="$private/state"
transaction="$private/transaction"
recover() {
 local had rel name
 [[ -d "$transaction" && ! -L "$transaction" ]] || return 0
 if [[ -f "$transaction/ready" ]]; then
  while IFS=$'\t' read -r had rel; do
   check_target "$rel"
   if [[ "$had" == 1 ]]; then copy_atomic "$transaction/backup/$rel" "$root/$rel"
   elif [[ "$had" == 0 ]]; then rm -f -- "$root/$rel"
   else fail 'Invalid recovery journal'; fi
  done < "$transaction/journal.tsv"
  for name in current.manifest history current initialized; do
   if [[ -f "$transaction/state/$name" ]]; then cp -- "$transaction/state/$name" "$state/$name"
   else rm -f -- "$state/$name"; fi
  done
 fi
 rm -rf -- "$transaction"
}
if [[ "$mode" == check ]]; then
 [[ -w "$root" && -w "$private" ]] || fail 'DEV directories are not writable'
 printf 'DEV configuration verified; no publication performed.\n'
 exit 0
fi
if [[ "$mode" == prepare ]]; then
 release=${3:?Missing release ID}
 [[ "$release" =~ ^[0-9]+-[0-9]+$ ]] || fail 'Invalid release ID'
 mkdir -- "$private/incoming/$release"
 mkdir -- "$private/incoming/$release/dist"
 exit 0
fi
case "$mode" in publish|rollback|recover) ;; *) fail 'Unknown operation';; esac
mkdir -- "$private/publish.lock" 2>/dev/null || fail 'Publication locked; verify the owner before recovery'
printf '%s\n' "$$" > "$private/publish.lock/pid"
cleanup() {
 local code=$?
 trap - EXIT INT TERM
 if [[ "$code" != 0 && -d "$transaction" ]]; then
  # A recovery error intentionally leaves the lock and journal for the operator.
  set +e
  (set -e; recover)
  recovery=$?
  set -e
  if [[ "$recovery" != 0 ]]; then printf 'Recovery failed; keep lock and journal for inspection.\n' >&2; exit 1; fi
 fi
 rmdir -- "$private/publish.lock" 2>/dev/null || { rm -f -- "$private/publish.lock/pid"; rmdir -- "$private/publish.lock"; }
 exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
recover
[[ "$mode" != recover ]] || exit 0
release=${3:?Missing release ID}
[[ "$release" =~ ^[0-9]+-[0-9]+$ ]] || fail 'Invalid release ID'
if [[ "$mode" == publish ]]; then
 commit=${4:?Missing commit}; first=${5:-0}
 [[ "$commit" =~ ^[a-f0-9]{40,64}$ ]] || fail 'Invalid commit'
 [[ "$first" == 0 || "$first" == 1 ]] || fail 'Invalid initialization flag'
 if [[ ! -f "$state/initialized" ]]; then [[ "$first" == 1 ]] || fail 'First deployment must be explicitly manual'
 else [[ "$first" == 0 ]] || fail 'DEV was already initialized'; fi
 candidate="$private/incoming/$release"
 [[ -d "$candidate" && ! -L "$candidate" && ! -e "$private/releases/$release" ]] || fail 'Missing staging directory or reused release ID'
else
 [[ -f "$state/initialized" && -f "$state/history" ]] || fail 'DEV has no previous release'
 grep -Fxq -- "$release" "$state/history" || fail 'Rollback limited to retained published versions'
 candidate="$private/releases/$release"
 [[ -d "$candidate" && ! -L "$candidate" ]] || fail 'Invalid rollback directory'
 commit=$(cat "$candidate/commit")
 [[ "$commit" =~ ^[a-f0-9]{40,64}$ ]] || fail 'Invalid saved commit'
fi
validate_manifest "$candidate/manifest.tsv"
[[ -d "$candidate/dist" && ! -L "$candidate/dist" ]] || fail 'Missing dist directory'
[[ -z $(find "$candidate/dist" -type l -print -quit) ]] || fail 'Symlink in artifact'
[[ -z $(find "$candidate/dist" ! -type d ! -type f -print -quit) ]] || fail 'Special file in artifact'
[[ $(find "$candidate/dist" -type f | wc -l | tr -d ' ') == $(wc -l < "$candidate/manifest.tsv" | tr -d ' ') ]] || fail 'Artifact and manifest differ'
while IFS=$'\t' read -r sha rel; do
 [[ -f "$candidate/dist/$rel" && $(hash "$candidate/dist/$rel") == "$sha" ]] || fail 'Artifact checksum mismatch'
done < "$candidate/manifest.tsv"
[[ -n $(lookup "$candidate/manifest.tsv" index.html) && -n $(lookup "$candidate/manifest.tsv" agenda/index.html) ]] || fail 'Required Astro pages missing'
mkdir -p -- "$transaction/state" "$transaction/backup"
for name in current.manifest history current initialized; do
 [[ ! -e "$state/$name" || ( -f "$state/$name" && ! -L "$state/$name" ) ]] || fail 'Invalid deployment state'
 if [[ -f "$state/$name" ]]; then cp -- "$state/$name" "$transaction/state/$name"; fi
done
old="$transaction/old.tsv"
if [[ -f "$state/current.manifest" ]]; then validate_manifest "$state/current.manifest"; cp -- "$state/current.manifest" "$old"; else : > "$old"; fi
cp -- "$candidate/manifest.tsv" "$transaction/next.tsv"
if [[ -f "$state/history" ]]; then
 head -n 2 "$state/history" | while IFS= read -r previous; do
  [[ "$previous" =~ ^[0-9]+-[0-9]+$ ]] || fail 'Invalid retained release'
  validate_manifest "$private/releases/$previous/manifest.tsv"
  awk -F '\t' '$2 ~ /^_astro\//' "$private/releases/$previous/manifest.tsv" >> "$transaction/next.tsv"
 done
fi
awk -F '\t' '!seen[$2]++' "$transaction/next.tsv" > "$transaction/unique.tsv"
mv -- "$transaction/unique.tsv" "$transaction/next.tsv"
cat "$old" "$transaction/next.tsv" | cut -f 2 | LC_ALL=C sort -u > "$transaction/paths"
: > "$transaction/journal.tsv"
while IFS= read -r rel; do
 check_target "$rel"
 if [[ -f "$root/$rel" ]]; then
  sha=$(lookup "$old" "$rel")
  [[ -n "$sha" ]] || fail "Unmanaged file collision: $rel"
  [[ $(hash "$root/$rel") == "$sha" ]] || fail "Managed file changed outside deployment: $rel"
  mkdir -p -- "$transaction/backup/$(dirname -- "$rel")"
  cp -- "$root/$rel" "$transaction/backup/$rel"
  printf '1\t%s\n' "$rel" >> "$transaction/journal.tsv"
 else printf '0\t%s\n' "$rel" >> "$transaction/journal.tsv"; fi
done < "$transaction/paths"
touch "$transaction/ready"
# First assets, then HTML, so pages never point at assets not uploaded yet.
for html in 0 1; do
 while IFS=$'\t' read -r sha rel; do
  case "$rel" in *.html) is_html=1;; *) is_html=0;; esac
  [[ "$is_html" == "$html" ]] || continue
  source="$candidate/dist/$rel"
  if [[ ! -f "$source" ]]; then
   source=''
   while IFS= read -r previous; do
    possible="$private/releases/$previous/dist/$rel"
    if [[ -f "$possible" && $(hash "$possible") == "$sha" ]]; then source=$possible; break; fi
   done < "$state/history"
   [[ -n "$source" ]] || fail 'Retained asset missing'
  fi
  copy_atomic "$source" "$root/$rel"
 done < "$transaction/next.tsv"
done
while IFS=$'\t' read -r sha rel; do
 if [[ -z $(lookup "$transaction/next.tsv" "$rel") ]]; then rm -f -- "$root/$rel"; fi
done < "$old"
if [[ "$mode" == publish ]]; then
 printf '%s\n' "$commit" > "$candidate/commit"
 mv -- "$candidate" "$private/releases/$release"
fi
{ printf '%s\n' "$release"; if [[ -f "$state/history" ]]; then cat "$state/history"; fi; } | awk '!seen[$0]++' | head -n 3 > "$transaction/history"
cp -- "$transaction/next.tsv" "$state/current.manifest"
cp -- "$transaction/history" "$state/history"
printf '%s\n' "$release" > "$state/current"
printf '%s\n' dev.fanfareuid.ch > "$state/initialized"
rm -rf -- "$transaction"
for directory in "$private/releases/"*; do
 [[ -d "$directory" && ! -L "$directory" ]] || continue
 name=${directory##*/}
 if [[ "$name" =~ ^[0-9]+-[0-9]+$ ]] && ! grep -Fxq -- "$name" "$state/history"; then rm -rf -- "$directory"; fi
done
printf 'Published DEV release %s (%s).\n' "$release" "$commit"
