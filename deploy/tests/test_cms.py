"""Signed CMS protocol/diagnostic tests. All HTTP responses are simulated."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import socket
import ssl
import tempfile
import unittest
import urllib.error
from unittest.mock import patch

DEPLOY = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('cms_actions', DEPLOY / 'actions.py')
actions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(actions)
TOKEN = '01234567-89ab-4def-8123-456789abcdef'


class CMSProtocolTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='uid-cms-test-')
        self.addCleanup(self.temp.cleanup)
        self.snapshot = Path(self.temp.name) / 'snapshot.json'
        self.logs = io.StringIO()
        self.secret = 'ab' * 32  # Public test data only.
        self.env = patch.dict(os.environ, {
            'DEPLOY_ENVIRONMENT': 'development', 'WORDPRESS_API_BASE': actions.DEV_API,
            'WORDPRESS_LUTINS_PAGE_ID': '11', 'WORDPRESS_AVENTURIERS_PAGE_ID': '12',
            'WORDPRESS_CALENDAR_PAGE_ID': '13', 'GITHUB_RUN_ID': '123',
            'UID_CMS_HMAC_SECRET': self.secret,
        }, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.opener = self.enterContext(patch.object(actions.urllib.request, 'build_opener')).return_value
        self.enterContext(patch.object(actions.time, 'sleep'))

    def response(self, data):
        return io.BytesIO(json.dumps(data).encode())

    def http_error(self, status, code=None):
        # Unknown response contents and exception text must never reach diagnostics.
        body = {'code': code, 'message': self.secret, 'token': TOKEN, 'signature': 'f'*64}
        return urllib.error.HTTPError(actions.DEV_ORIGIN, status, 'unsafe '+self.secret, None, self.response(body))

    def call(self, operation='snapshot'):
        with contextlib.redirect_stderr(self.logs):
            actions.cms(operation, self.snapshot)

    def assert_safe(self, message=''):
        output = self.logs.getvalue() + message
        for sensitive in (self.secret, TOKEN, 'f'*64, 'unsafe', 'github-token-test'):
            self.assertNotIn(sensitive, output)

    def test_python_php_shared_hmac_vector(self):
        vector = json.loads((DEPLOY.parent / 'wordpress/tests/hmac-vector.json').read_text())
        self.assertEqual(actions.signature(vector['key'], vector['timestamp'], vector['nonce'], vector['body'].encode('utf-8')), vector['signature'])

    def test_request_signs_exact_transmitted_bytes_and_accepts_snapshot(self):
        self.opener.open.return_value = self.response({'token': TOKEN})
        self.call()
        request = self.opener.open.call_args.args[0]
        self.assertEqual(request.full_url, actions.DEV_ORIGIN+'/wordpress/wp-json/uid-headless/v1/deployment')
        self.assertEqual(request.get_method(), 'POST')
        self.assertEqual(request.data, b'{"operation":"snapshot","run":"123"}')
        headers = {name.lower(): value for name,value in request.header_items()}
        self.assertEqual(headers['content-type'], 'application/json')
        self.assertRegex(headers['x-uid-time'], r'^\d{10}$')
        self.assertRegex(headers['x-uid-nonce'], r'^[a-f0-9]{32}$')
        self.assertEqual(headers['x-uid-signature'], actions.signature(self.secret, headers['x-uid-time'], headers['x-uid-nonce'], request.data))
        self.assertEqual(json.loads(self.snapshot.read_text())['token'], TOKEN)
        self.assertEqual(self.snapshot.stat().st_mode & 0o777, 0o600)
        self.assertIs(actions.urllib.request.build_opener.call_args.args[0], actions.NoRedirect)
        self.assert_safe()

    def test_http_403_authentication_is_not_retried_or_hidden(self):
        self.opener.open.side_effect = self.http_error(403, 'uid_auth')
        with self.assertRaisesRegex(RuntimeError, 'category=authentication http=403 wp_code=uid_auth') as error:
            self.call()
        self.assertEqual(self.opener.open.call_count, 1)
        self.assert_safe(str(error.exception))
        self.assertFalse(self.snapshot.exists())

    def test_retryable_http_errors_include_safe_wordpress_codes(self):
        for status, code in [(503,'uid_lock'), (503,'uid_storage'), (503,'uid_disabled'), (429,None), (502,None)]:
            with self.subTest(status=status,code=code):
                self.opener.open.reset_mock()
                self.opener.open.side_effect = [self.http_error(status,code) for _ in range(3)]
                with self.assertRaisesRegex(RuntimeError, f'after three attempts: category=http http={status}') as error:
                    self.call()
                if code:
                    self.assertIn('wp_code='+code, str(error.exception))
                self.assertEqual(self.opener.open.call_count, 3)
                self.assert_safe(str(error.exception))

    def test_http_redirects_and_unknown_error_codes_are_not_followed_or_echoed(self):
        self.opener.open.side_effect = self.http_error(302, 'unsafe-'+self.secret)
        with self.assertRaisesRegex(RuntimeError, 'category=http http=302') as error:
            self.call()
        self.assertEqual(self.opener.open.call_count, 1)
        self.assert_safe(str(error.exception))

    def test_network_errors_are_classified_without_exception_text(self):
        cases = [
            (urllib.error.URLError(socket.gaierror(-2,self.secret)), 'dns'),
            (urllib.error.URLError(ssl.SSLCertVerificationError(1,self.secret)), 'tls_certificate'),
            (urllib.error.URLError(ssl.SSLError(1,self.secret)), 'tls'),
            (TimeoutError(self.secret), 'timeout'),
            (urllib.error.URLError(ConnectionRefusedError(self.secret)), 'connection_refused'),
            (ConnectionResetError(self.secret), 'connection_reset'),
            (urllib.error.URLError('unsafe '+self.secret), 'connection'),
        ]
        for exception, kind in cases:
            with self.subTest(kind=kind):
                self.opener.open.reset_mock()
                self.opener.open.side_effect = exception
                with self.assertRaisesRegex(RuntimeError, 'category=network reason='+kind) as error:
                    self.call()
                self.assertEqual(self.opener.open.call_count,3)
                self.assert_safe(str(error.exception))

    def test_invalid_success_responses_fail_safely(self):
        cases = [(b'<html>'+self.secret.encode()+b'</html>', 'invalid_json'),
                 (b'[]', 'expected_object'), (b'null', 'expected_object'),
                 (b'{}', 'invalid_snapshot_token'),
                 (b'{"token":123}', 'invalid_snapshot_token'),
                 (b'x'*65537, 'response_too_large')]
        for raw, reason in cases:
            with self.subTest(reason=reason):
                self.opener.open.reset_mock()
                self.opener.open.return_value = io.BytesIO(raw)
                with self.assertRaisesRegex(RuntimeError, 'category=response_format reason='+reason) as error:
                    self.call()
                self.assertEqual(self.opener.open.call_count,1)
                self.assertFalse(self.snapshot.exists())
                self.assert_safe(str(error.exception))

    def test_ack_and_fail_require_explicit_success_and_send_snapshot_token(self):
        self.snapshot.write_text(json.dumps({'token':TOKEN}))
        for operation in ('ack','fail'):
            self.opener.open.return_value = self.response({'ok':True})
            self.call(operation)
            request = self.opener.open.call_args.args[0]
            self.assertEqual(json.loads(request.data), {'operation':operation,'run':'123','token':TOKEN})
            self.opener.open.return_value = self.response({'ok':False, 'token':TOKEN})
            with self.assertRaisesRegex(RuntimeError, 'reason=missing_ok_true') as error:
                self.call(operation)
            self.assert_safe(str(error.exception))

    def test_transient_failure_then_success_uses_a_new_nonce(self):
        self.opener.open.side_effect = [self.http_error(503,'uid_lock'), self.response({'token':TOKEN})]
        self.call()
        requests = [call.args[0] for call in self.opener.open.call_args_list]
        self.assertEqual(requests[0].data, requests[1].data)
        self.assertNotEqual(requests[0].get_header('X-uid-nonce'), requests[1].get_header('X-uid-nonce'))
        self.assertEqual(json.loads(self.snapshot.read_text())['token'], TOKEN)
        self.assert_safe()


if __name__ == '__main__':
    unittest.main()
