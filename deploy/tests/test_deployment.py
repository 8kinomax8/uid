import hashlib
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

DEPLOY = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('actions', DEPLOY / 'actions.py')
actions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(actions)


class DeploymentTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='uid-dev-test-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.root = self.base / 'dev.fanfareuid.ch'
        self.production = self.base / 'httpdocs'
        self.private = self.base / 'private'
        for directory in [self.root, self.production, self.private / 'incoming', self.private / 'releases', self.private / 'state']:
            directory.mkdir(parents=True)
        (self.root / '.uid-dev-target').write_text('dev.fanfareuid.ch\n')
        (self.root / 'wordpress').mkdir()
        (self.root / 'wordpress' / 'wp-config.php').write_text('WORDPRESS')
        (self.root / '.htaccess').write_text('EXISTING RULES')
        (self.root / 'unmanaged.txt').write_text('UNMANAGED')
        (self.production / 'index.html').write_text('PRODUCTION')
        # Relocate only the two pinned server paths in the disposable test copy.
        # The production script has no test flag/environment bypass for these guards.
        self.script = self.private / 'publisher.sh'
        self.script.write_text((DEPLOY / 'uid-publish.sh').read_text().replace('/dev.fanfareuid.ch', str(self.root)).replace('/private/uid-dev', str(self.private)))
        self.config = self.private / 'server.env'
        self.config.write_text(f'UID_TARGET_HOST=dev.fanfareuid.ch\nUID_DOCUMENT_ROOT={self.root}\nUID_PRIVATE_DIR={self.private}\n')

    def call(self, mode, *args, success=True):
        result = subprocess.run(['bash', str(self.script), str(self.config), mode, *args], capture_output=True, text=True)
        if success:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        return result

    def release(self, release, extra=None):
        self.call('prepare', release)
        directory = self.private / 'incoming' / release
        for name, value in {'index.html':release, 'agenda/index.html':'agenda', '_astro/shared.js':'asset', **(extra or {})}.items():
            file = directory / 'dist' / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(value)
        actions.manifest(directory / 'dist', directory / 'manifest.tsv')
        return directory

    def publish(self, release, first=False):
        return self.call('publish', release, 'a' * 40, '1' if first else '0')

    def test_first_deployment_requires_explicit_manual_initialization(self):
        self.release('101-1')
        self.call('publish', '101-1', 'a'*40, '0', success=False)
        self.assertFalse((self.root / 'index.html').exists())
        self.publish('101-1', True)
        self.release('102-1')
        self.call('publish', '102-1', 'a'*40, '1', success=False)
        self.publish('102-1')

    def test_publish_preserves_unmanaged_wordpress_production_and_rolls_back(self):
        self.release('101-1', {'old/index.html':'old', '_astro/first.js':'first'})
        self.publish('101-1', True)
        self.release('102-1', {'new/index.html':'new'})
        self.publish('102-1')
        self.assertFalse((self.root / 'old/index.html').exists())
        self.assertTrue((self.root / '_astro/first.js').exists())
        self.call('rollback', '101-1')
        self.assertEqual((self.root / 'index.html').read_text(), '101-1')
        self.assertFalse((self.root / 'new/index.html').exists())
        self.assertEqual((self.root / 'wordpress/wp-config.php').read_text(), 'WORDPRESS')
        self.assertEqual((self.root / 'unmanaged.txt').read_text(), 'UNMANAGED')
        self.assertEqual((self.root / '.htaccess').read_text(), 'EXISTING RULES')
        self.assertEqual((self.production / 'index.html').read_text(), 'PRODUCTION')

    def test_unmanaged_collision_and_external_edits_abort_before_publication(self):
        self.release('101-1')
        (self.root / 'index.html').write_text('UNOWNED')
        self.call('publish', '101-1', 'a'*40, '1', success=False)
        self.assertEqual((self.root / 'index.html').read_text(), 'UNOWNED')
        (self.root / 'index.html').unlink()
        self.publish('101-1', True)
        self.release('102-1')
        (self.root / 'index.html').write_text('EXTERNAL EDIT')
        self.call('publish', '102-1', 'a'*40, '0', success=False)
        self.assertEqual((self.root / 'index.html').read_text(), 'EXTERNAL EDIT')

    def test_reject_production_root_missing_attestation_and_symlink(self):
        self.config.write_text(f'UID_TARGET_HOST=dev.fanfareuid.ch\nUID_DOCUMENT_ROOT={self.production}\nUID_PRIVATE_DIR={self.private}\n')
        self.call('check', success=False)
        self.config.write_text(f'UID_TARGET_HOST=dev.fanfareuid.ch\nUID_DOCUMENT_ROOT={self.root}\nUID_PRIVATE_DIR={self.private}\n')
        (self.root / '.uid-dev-target').unlink()
        self.call('check', success=False)
        (self.root / '.uid-dev-target').write_text('dev.fanfareuid.ch')
        self.release('101-1')
        (self.root / 'agenda').symlink_to(self.production, target_is_directory=True)
        self.call('publish', '101-1', 'a'*40, '1', success=False)
        self.assertEqual((self.production / 'index.html').read_text(), 'PRODUCTION')

    def test_manifest_protects_wordpress_and_checks_integrity(self):
        for name in ['../index.html','wordpress/a.jpg','WordPress/test','a/.git','x.php','a\\b','a\tb','node_modules/foo']:
            with self.assertRaises(ValueError): actions.safe_relative(name)
        directory = self.release('101-1')
        (directory / 'dist/index.html').write_text('CORRUPTED')
        self.call('publish', '101-1', 'a'*40, '1', success=False)
        self.assertFalse((self.root / 'index.html').exists())
        (directory / 'dist/extra.txt').write_text('UNLISTED')
        self.call('publish', '101-1', 'a'*40, '1', success=False)

    def test_server_lock_rejects_concurrent_publication(self):
        self.release('101-1')
        (self.private / 'publish.lock').mkdir()
        self.call('publish', '101-1', 'a'*40, '1', success=False)
        self.assertFalse((self.root / 'index.html').exists())

    def test_recover_interrupted_publication_restores_managed_files(self):
        self.release('101-1')
        self.publish('101-1',True)
        transaction = self.private / 'transaction'
        (transaction / 'backup').mkdir(parents=True)
        (transaction / 'state').mkdir()
        for name in ['current.manifest','history','current','initialized']:
            shutil.copyfile(self.private / 'state' / name, transaction / 'state' / name)
        shutil.copyfile(self.root / 'index.html', transaction / 'backup/index.html')
        (transaction / 'journal.tsv').write_text('1\tindex.html\n0\tadded.html\n')
        (transaction / 'ready').touch()
        (self.root / 'index.html').write_text('PARTIAL')
        (self.root / 'added.html').write_text('PARTIAL')
        self.call('recover')
        self.assertEqual((self.root / 'index.html').read_text(), '101-1')
        self.assertFalse((self.root / 'added.html').exists())

    def test_keeps_three_versions_and_protected_unicode_paths(self):
        for number in range(101,105):
            self.release(f'{number}-1', {'images/bannière cadets.jpg':'image'})
            self.publish(f'{number}-1', number==101)
        self.assertEqual(len(list((self.private / 'releases').iterdir())),3)
        self.call('rollback','101-1',success=False)
        self.assertEqual((self.root / 'images/bannière cadets.jpg').read_text(),'image')

    def test_ci_environment_is_dev_only_and_ssh_is_pinned(self):
        env={'DEPLOY_ENVIRONMENT':'development','WORDPRESS_API_BASE':actions.DEV_API,'WORDPRESS_LUTINS_PAGE_ID':'1','WORDPRESS_AVENTURIERS_PAGE_ID':'2','WORDPRESS_CALENDAR_PAGE_ID':'3'}
        with patch.dict(os.environ,env,clear=True):
            actions.environment()
            os.environ['WORDPRESS_API_BASE']='https://fanfareuid.ch/wordpress/wp-json/wp/v2'
            with self.assertRaises(ValueError): actions.environment()
            with self.assertRaises(ValueError): actions.ssh_settings()

    def test_restricted_ssh_key_allows_only_publisher_and_private_rsync(self):
        gate = self.private / 'gate.sh'
        source = (DEPLOY / 'uid-ssh-gate.sh').read_text()
        source = source.replace('exec /usr/bin/bash "${words[@]:1}"', "printf 'publisher permitted'; exit 0")
        source = source.replace('exec /usr/bin/rsync "${words[@]:1}"', "printf 'rsync permitted'; exit 0")
        gate.write_text(source)
        private = actions.PRIVATE
        commands = [
            (f'/usr/bin/bash {private}/bin/uid-publish.sh {private}/server.env check', True),
            (f'rsync --server -logDtpre.iLsfxCIvu . {private}/incoming/101-1/dist/', True),
            (f'rsync --server -l -p -D -r -t --dirs . {private}/incoming/101-1/manifest.tsv', True),
            ('sh -c id', False),
            ('/usr/bin/bash /home/httpd/vhosts/fanfareuid.ch/private/uid-dev/bin/uid-publish.sh /home/httpd/vhosts/fanfareuid.ch/private/uid-dev/server.env check', False),
            ('/usr/bin/rsync --server -l . /home/httpd/vhosts/fanfareuid.ch/private/uid-dev/incoming/101-1/dist/', False),
            ('/usr/bin/rsync --server -l . /dev.fanfareuid.ch/wordpress/', False),
            (f'/usr/bin/rsync --server -l . {private}/incoming/101-1/dist/', True),
            (f'rsync --server -l . {private}/server.env', False),
            (f'rsync --server --delete . {private}/incoming/101-1/dist/', False),
            (f'rsync --server -K . {private}/incoming/101-1/dist/', False),
            (f'rsync --server -s . {private}/incoming/101-1/dist/', False),
            (f'rsync --server -l . {private}/incoming/../server.env', False),
            (f'/usr/bin/bash {private}/bin/uid-publish.sh {private}/server.env check; id', False),
        ]
        for command, permitted in commands:
            result = subprocess.run(['bash', str(gate)], env={**os.environ, 'SSH_ORIGINAL_COMMAND':command}, capture_output=True)
            self.assertEqual(result.returncode == 0, permitted, command)

    def test_transfer_is_private_and_ssh_checks_host_keys(self):
        key=self.private/'key'; known=self.private/'known_hosts'
        key.write_text('test key'); known.write_text('test known hosts')
        env={'DEV_SSH_HOST':actions.SSH_HOST,'DEV_SSH_PORT':actions.SSH_PORT,'DEV_SSH_USER':actions.SSH_USER,'DEV_REMOTE_PRIVATE_DIR':actions.PRIVATE,'UID_SSH_KEY_FILE':str(key),'UID_KNOWN_HOSTS_FILE':str(known)}
        with patch.dict(os.environ,env,clear=True), patch.object(actions.subprocess,'run') as run:
            actions.upload(self.root,self.private/'manifest.tsv','101-1')
            commands=[call.args[0] for call in run.call_args_list]
            self.assertIn('StrictHostKeyChecking=yes',commands[0])
            self.assertEqual(commands[0][commands[0].index('-p')+1],'2121')
            for command in commands[1:]:
                self.assertNotIn('--delete',command)
                self.assertIn('--rsync-path=/usr/bin/rsync',command)
                self.assertNotIn('/home/httpd/', ' '.join(command))
                self.assertIn(actions.PRIVATE+'/incoming/101-1/',command[-1])
                self.assertNotIn('/dev.fanfareuid.ch/',command[-1])
            run.reset_mock()
            with self.assertRaises(ValueError): actions.remote('rollback')
            run.assert_not_called()

    def test_configuration_path_is_pinned_before_sourcing(self):
        unexpected=self.private/'unexpected.env'
        marker=self.base/'config-was-executed'
        unexpected.write_text(f'touch {marker}\n')
        result=subprocess.run(['bash',str(self.script),str(unexpected),'check'],capture_output=True)
        self.assertNotEqual(result.returncode,0)
        self.assertFalse(marker.exists())
        real_config=self.private/'real-config.env'
        self.config.rename(real_config)
        self.config.symlink_to(real_config)
        self.call('check',success=False)

    def test_canonical_dev_root_cannot_redirect_to_production(self):
        self.root.rename(self.base/'original-dev')
        self.root.symlink_to(self.production,target_is_directory=True)
        self.call('check',success=False)
        self.assertEqual((self.production/'index.html').read_text(),'PRODUCTION')

    def test_runner_rejects_non_chroot_private_path_before_ssh(self):
        env={'DEV_SSH_HOST':actions.SSH_HOST,'DEV_SSH_PORT':actions.SSH_PORT,'DEV_SSH_USER':actions.SSH_USER,'DEV_REMOTE_PRIVATE_DIR':'/home/httpd/vhosts/fanfareuid.ch/private/uid-dev'}
        with patch.dict(os.environ,env,clear=True), patch.object(actions.subprocess,'run') as run:
            with self.assertRaises(ValueError): actions.remote('check')
            run.assert_not_called()

    @unittest.skipUnless(shutil.which('rsync'), 'rsync is required for the local protocol test')
    def test_real_rsync_protocol_passes_guard_into_private_staging(self):
        # Real rsync sender/receiver, connected through a local stand-in for SSH.
        # No SSH daemon, network connection, real chroot or server is involved.
        release='301-1'
        self.call('prepare',release)
        source=self.base/'artifact'
        (source/'agenda').mkdir(parents=True)
        (source/'images').mkdir()
        (source/'index.html').write_text('LOCAL TEST')
        (source/'agenda/index.html').write_text('agenda')
        (source/'images/bannière cadets.jpg').write_bytes(b'image')
        manifest=self.base/'manifest.tsv'
        actions.manifest(source,manifest)
        gate=self.private/'real-gate.sh'
        gate.write_text((DEPLOY/'uid-ssh-gate.sh').read_text().replace('/private/uid-dev',str(self.private)))
        transport=self.base/'local-ssh'
        import sys
        transport.write_text(f'#!{sys.executable}\nimport os,shlex,sys\ni=sys.argv.index("--server")\nos.environ["SSH_ORIGINAL_COMMAND"]=shlex.join(sys.argv[i-1:])\nos.execv({shutil.which("bash")!r},["bash",{str(gate)!r}])\n')
        transport.chmod(0o700)
        with patch.object(actions,'PRIVATE',str(self.private)), patch.object(actions,'remote'), patch.object(actions,'ssh_settings',return_value=[str(transport)]):
            actions.upload(source,manifest,release)
        incoming=self.private/'incoming'/release
        self.assertEqual((incoming/'manifest.tsv').read_bytes(),manifest.read_bytes())
        self.assertEqual((incoming/'dist/index.html').read_text(),'LOCAL TEST')
        self.assertEqual((incoming/'dist/images/bannière cadets.jpg').read_bytes(),b'image')
        self.assertFalse((self.root/'index.html').exists())
        self.assertEqual((self.root/'wordpress/wp-config.php').read_text(),'WORDPRESS')
        self.assertEqual((self.production/'index.html').read_text(),'PRODUCTION')

    def test_hmac_binds_timestamp_nonce_and_payload(self):
        secret='ab'*32
        original=actions.signature(secret,'123','nonce',b'{"operation":"ack"}')
        self.assertNotEqual(original,actions.signature(secret,'124','nonce',b'{"operation":"ack"}'))
        self.assertNotEqual(original,actions.signature(secret,'123','other',b'{"operation":"ack"}'))
        self.assertNotEqual(original,actions.signature(secret,'123','nonce',b'{"operation":"fail"}'))


if __name__ == '__main__': unittest.main()
