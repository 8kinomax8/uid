#!/usr/bin/env python3
"""GitHub runner only: validate dist, sign CMS requests, transfer to private staging."""
import argparse
import hashlib
import hmac
import http.client
import json
import os
from pathlib import Path
import re
import shlex
import socket
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

DEV_ORIGIN = 'https://dev.fanfareuid.ch'
DEV_API = DEV_ORIGIN + '/wordpress/wp-json/wp/v2'
# All remote paths are resolved inside SSH's chroot, never in PHP's host namespace.
PRIVATE = '/private/uid-dev'
SSH_HOST = 'ananke.kreativmedia.ch'
SSH_USER = 'fanfareuid'
SSH_PORT = '2121'


def environment(require_pages=True):
    if os.environ.get('WORDPRESS_API_BASE') != DEV_API:
        raise ValueError('Only the verified WordPress DEV API is allowed')
    if os.environ.get('DEPLOY_ENVIRONMENT') != 'development':
        raise ValueError('DEPLOY_ENVIRONMENT must be development')
    if not require_pages:
        return
    for name in ('WORDPRESS_LUTINS_PAGE_ID', 'WORDPRESS_AVENTURIERS_PAGE_ID', 'WORDPRESS_CALENDAR_PAGE_ID'):
        if not re.fullmatch(r'[1-9][0-9]*', os.environ.get(name, '')):
            raise ValueError(f'Missing valid DEV page ID: {name}')
    if len({os.environ[name] for name in ('WORDPRESS_LUTINS_PAGE_ID', 'WORDPRESS_AVENTURIERS_PAGE_ID', 'WORDPRESS_CALENDAR_PAGE_ID')}) != 3:
        raise ValueError('DEV page IDs must be distinct')


def safe_relative(relative):
    if not relative or relative.startswith('/') or '\\' in relative or any(ord(c) < 32 or ord(c) == 127 for c in relative):
        raise ValueError('Unsafe artifact path')
    for part in relative.split('/'):
        if not part or part.startswith('.') or part.lower() in ('wordpress', 'node_modules', 'src', 'deploy'):
            raise ValueError(f'Protected artifact path: {relative}')
    if re.search(r'\.(php[0-9]?|phtml|phar|env|map|sh|mjs|ts)$', relative, re.I):
        raise ValueError(f'Forbidden artifact: {relative}')
    return relative


def manifest(dist, output):
    root = Path(dist)
    if root.is_symlink() or not root.is_dir():
        raise ValueError('Missing regular dist directory')
    entries = []
    for file in sorted(root.rglob('*')):
        relative = safe_relative(file.relative_to(root).as_posix())
        if file.is_symlink():
            raise ValueError('Symlink in artifact')
        if file.is_dir():
            continue
        if not file.is_file():
            raise ValueError('Special file in artifact')
        entries.append((hashlib.sha256(file.read_bytes()).hexdigest(), relative))
    if not {'index.html', 'agenda/index.html'}.issubset({name for _, name in entries}):
        raise ValueError('Required Astro pages missing')
    Path(output).write_text(''.join(f'{sha}\t{name}\n' for sha, name in entries), encoding='utf8')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def signature(secret, stamp, nonce, body):
    return hmac.new(secret.encode(), f'{stamp}\n{nonce}\n'.encode() + body, hashlib.sha256).hexdigest()


CMS_ERROR_HINTS = {
    'uid_disabled': 'check DEV environment, HMAC configuration and private directory permissions',
    'uid_auth': 'check identical text secrets, clocks and transmission of headers/body',
    'uid_replay': 'nonce already used or nonce file could not be created',
    'uid_payload': 'check operation and GitHub run ID',
    'uid_lock': 'check PHP access to cms-state/github-dispatch.lock',
    'uid_storage': 'check PHP write/rename access and free space in cms-state',
    'uid_token': 'snapshot absent or invalid',
    'uid_run': 'snapshot belongs to another GitHub run',
    'rest_no_route': 'check DEV plugin version and REST route',
    'rest_invalid_json': 'request JSON was rejected',
}


def cms_http_diagnostic(error):
    # Never log arbitrary response bodies/messages: they can contain credentials.
    code = None
    try:
        raw = error.read(4097)
        data = json.loads(raw) if len(raw) <= 4096 else None
        candidate = data.get('code') if isinstance(data, dict) else None
        if isinstance(candidate, str) and candidate in CMS_ERROR_HINTS:
            code = candidate
    except (ValueError, OSError, http.client.HTTPException):
        pass
    category = 'authentication' if code in ('uid_auth', 'uid_run') or error.code == 401 else 'http'
    detail = f'category={category} http={error.code}'
    if code:
        detail += f' wp_code={code}; {CMS_ERROR_HINTS[code]}'
    return detail


def cms_network_diagnostic(error):
    reason = error.reason if isinstance(error, urllib.error.URLError) else error
    # Classify by type, not str(error): exception text may contain a signed request.
    if isinstance(reason, ssl.SSLCertVerificationError):
        kind = 'tls_certificate'
    elif isinstance(reason, ssl.SSLError):
        kind = 'tls'
    elif isinstance(reason, socket.gaierror):
        kind = 'dns'
    elif isinstance(reason, TimeoutError):
        kind = 'timeout'
    elif isinstance(reason, ConnectionRefusedError):
        kind = 'connection_refused'
    elif isinstance(reason, ConnectionResetError):
        kind = 'connection_reset'
    elif isinstance(reason, http.client.HTTPException):
        kind = 'http_transport'
    else:
        kind = 'connection'
    return f'category=network reason={kind}'


def cms(operation, snapshot_file):
    environment()
    if operation not in ('snapshot', 'ack', 'fail'):
        raise ValueError('Unknown CMS operation')
    secret = os.environ.get('UID_CMS_HMAC_SECRET', '')
    if not re.fullmatch(r'[a-f0-9]{64}', secret):
        raise ValueError('A 32-byte hex CMS HMAC secret is required')
    payload = {'operation': operation, 'run': os.environ.get('GITHUB_RUN_ID', '')}
    if operation != 'snapshot':
        payload['token'] = json.loads(Path(snapshot_file).read_text())['token']
    body = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    last_failure = 'category=unknown'
    for attempt in range(3):
        stamp, nonce = str(int(time.time())), uuid.uuid4().hex
        request = urllib.request.Request(DEV_ORIGIN + '/wordpress/wp-json/uid-headless/v1/deployment', data=body, method='POST', headers={
            'Content-Type': 'application/json', 'X-UID-Time': stamp, 'X-UID-Nonce': nonce,
            'X-UID-Signature': signature(secret, stamp, nonce, body),
        })
        try:
            with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
                raw = response.read(65537)
            if len(raw) > 65536:
                raise RuntimeError(f'CMS {operation}: category=response_format reason=response_too_large')
            try:
                result = json.loads(raw)
            except (ValueError, UnicodeDecodeError):
                raise RuntimeError(f'CMS {operation}: category=response_format reason=invalid_json') from None
            if not isinstance(result, dict):
                raise RuntimeError(f'CMS {operation}: category=response_format reason=expected_object')
            if operation == 'snapshot':
                token = result.get('token')
                if not isinstance(token, str) or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', token):
                    raise RuntimeError('CMS snapshot: category=response_format reason=invalid_snapshot_token')
                target = Path(snapshot_file)
                target.write_text(json.dumps(result))
                target.chmod(0o600)
            elif result.get('ok') is not True:
                raise RuntimeError(f'CMS {operation}: category=response_format reason=missing_ok_true')
            return
        except urllib.error.HTTPError as error:
            last_failure = cms_http_diagnostic(error)
            error.close()
            print(f'CMS {operation} attempt={attempt + 1}/3: {last_failure}', file=sys.stderr)
            if error.code < 500 and error.code != 429:
                raise RuntimeError(f'CMS {operation} rejected: {last_failure}') from None
        except (urllib.error.URLError, TimeoutError, ConnectionError, ssl.SSLError, http.client.HTTPException) as error:
            last_failure = cms_network_diagnostic(error)
            print(f'CMS {operation} attempt={attempt + 1}/3: {last_failure}', file=sys.stderr)
        if attempt < 2:
            time.sleep(2 ** attempt)
    raise RuntimeError(f'CMS {operation} handshake failed after three attempts: {last_failure}') from None


def ssh_settings():
    # Values are explicit GitHub environment variables and must match the confirmed DEV host.
    for name, expected in [('DEV_SSH_HOST', SSH_HOST), ('DEV_SSH_PORT', SSH_PORT), ('DEV_SSH_USER', SSH_USER), ('DEV_REMOTE_PRIVATE_DIR', PRIVATE)]:
        if os.environ.get(name) != expected:
            raise ValueError(f'{name} does not match the verified DEV configuration')
    key = os.environ.get('UID_SSH_KEY_FILE', '')
    known_hosts = os.environ.get('UID_KNOWN_HOSTS_FILE', '')
    if not Path(key).is_file() or not Path(known_hosts).is_file():
        raise ValueError('SSH key and verified known_hosts are required')
    return ['ssh', '-p', SSH_PORT, '-i', key, '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', f'UserKnownHostsFile={known_hosts}', '-o', 'ConnectTimeout=20']


def remote(operation, release=None, commit=None, first=False):
    command = ['/usr/bin/bash', PRIVATE + '/bin/uid-publish.sh', PRIVATE + '/server.env', operation]
    if operation in ('prepare', 'publish', 'rollback'):
        if not re.fullmatch(r'[0-9]+-[0-9]+', release or ''):
            raise ValueError('Invalid release ID')
        command.append(release)
    if operation == 'publish':
        if not re.fullmatch(r'[a-f0-9]{40,64}', commit or ''):
            raise ValueError('Invalid commit')
        command += [commit, '1' if first else '0']
    subprocess.run(ssh_settings() + [f'{SSH_USER}@{SSH_HOST}', shlex.join(command)], check=True)


def upload(dist, manifest_file, release):
    remote('prepare', release)
    # Never rsync to the document root, and never pass --delete (not even for staging).
    transport = shlex.join(ssh_settings())
    common = ['rsync', '--rsync-path=/usr/bin/rsync', '--archive', '--no-owner', '--no-group', '--chmod=Du=rwx,Dgo=,Fu=rw,Fgo=', '-e', transport]
    destination = f'{SSH_USER}@{SSH_HOST}:{PRIVATE}/incoming/{release}'
    subprocess.run(common + [str(Path(dist).resolve()) + '/', destination + '/dist/'], check=True)
    subprocess.run(common + [str(Path(manifest_file).resolve()), destination + '/manifest.tsv'], check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('operation', choices=['environment', 'manifest', 'snapshot', 'ack', 'fail', 'check', 'deploy', 'rollback'])
    parser.add_argument('--dist', default='astro/dist')
    parser.add_argument('--manifest', default='manifest.tsv')
    parser.add_argument('--snapshot', default='snapshot.json')
    parser.add_argument('--release')
    parser.add_argument('--commit')
    parser.add_argument('--first', action='store_true')
    args = parser.parse_args()
    if args.operation == 'environment':
        environment()
    elif args.operation == 'manifest':
        manifest(args.dist, args.manifest)
    elif args.operation in ('snapshot', 'ack', 'fail'):
        cms(args.operation, args.snapshot)
    elif args.operation == 'check':
        environment()
        remote('check')
    elif args.operation == 'deploy':
        environment()
        manifest(args.dist, args.manifest)
        remote('check')
        upload(args.dist, args.manifest, args.release)
        remote('publish', args.release, args.commit, args.first)
    elif args.operation == 'rollback':
        environment(require_pages=False)
        remote('rollback', args.release)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
