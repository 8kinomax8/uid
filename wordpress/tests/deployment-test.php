<?php
// Contract tests for the outbox, with WordPress HTTP/hooks stubbed. No external calls.
define('ABSPATH', __DIR__);
define('DAY_IN_SECONDS', 86400);
$fixture = sys_get_temp_dir() . '/uid-php-' . bin2hex(random_bytes(8));
mkdir($fixture, 0700, true); mkdir($fixture . '/state'); mkdir($fixture . '/web');
define('UID_STATE_DIR', $fixture . '/state');
define('UID_DOCUMENT_ROOT', $fixture . '/web');
define('UID_DEPLOY_ENVIRONMENT', 'development');
define('UID_CMS_HMAC_SECRET', str_repeat('ab', 32));
define('UID_GITHUB_TOKEN', 'test-only-token');
define('UID_GITHUB_DEPLOY_ENABLED', true);
register_shutdown_function(function () use ($fixture) {
    if (!is_dir($fixture)) { return; }
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($fixture, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($iterator as $file) { $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname()); }
    rmdir($fixture);
});
function add_action(...$args) {}
function add_filter(...$args) {}
function register_activation_hook(...$args) {}
function register_deactivation_hook(...$args) {}
function wp_json_encode($value) { return json_encode($value); }
function wp_generate_uuid4() { $hex = bin2hex(random_bytes(16)); return substr($hex,0,8).'-'.substr($hex,8,4).'-'.substr($hex,12,4).'-'.substr($hex,16,4).'-'.substr($hex,20); }
$GLOBALS['site'] = 'https://dev.fanfareuid.ch/wordpress';
function site_url() { return $GLOBALS['site']; }
function wp_parse_url($url,$component=-1) { return parse_url($url,$component); }
class WP_Error {
    public $code; public $message; public $data;
    function __construct($code,$message,$data=[]) { $this->code=$code; $this->message=$message; $this->data=$data; }
}
function is_wp_error($value) { return $value instanceof WP_Error; }
$GLOBALS['http_code'] = 503; $GLOBALS['http_calls'] = 0;
function wp_remote_post($url,$options) {
    check($url==='https://api.github.com/repos/8kinomax8/uid/actions/workflows/uid-dev.yml/dispatches','dispatch is pinned to the DEV workflow');
    check($options['redirection']===0,'GitHub redirects are forbidden');
    $body=json_decode($options['body'],true);
    check($body['ref']==='main' && $body['inputs']['source']==='wordpress' && $body['inputs']['first_deployment']==='false','CMS cannot initialize the first deployment');
    $GLOBALS['http_calls']++;
    return ['response'=>['code'=>$GLOBALS['http_code']]];
}
function wp_remote_retrieve_response_code($response) { return $response['response']['code']; }
function check($condition,$message) { if (!$condition) { throw new RuntimeException($message); } }
class Request {
    public $body; public $headers;
    function __construct($data) {
        $this->body=json_encode($data);
        $stamp=(string)time();$nonce=bin2hex(random_bytes(16));
        $this->headers=['x-uid-time'=>$stamp,'x-uid-nonce'=>$nonce,'x-uid-signature'=>hash_hmac('sha256',$stamp."\n".$nonce."\n".$this->body,UID_CMS_HMAC_SECRET)];
    }
    function get_header($name) { return $this->headers[$name] ?? ''; }
    function get_body() { return $this->body; }
    function get_json_params() { return json_decode($this->body,true); }
}
require __DIR__ . '/../uid-headless/uid-headless.php';
$vector=json_decode(file_get_contents(__DIR__ . '/hmac-vector.json'),true);
check(hash_hmac('sha256', $vector['timestamp']."\n".$vector['nonce']."\n".$vector['body'], $vector['key']) === $vector['signature'], 'shared Python/PHP HMAC vector matches');
function request($operation,$token=null,$run='123') {
    $data=['operation'=>$operation,'run'=>$run];if($token)$data['token']=$token;
    $req=new Request($data);
    check(uid_deploy_authorize($req)===true,'valid HMAC accepted');
    return uid_deploy_request($req);
}

$bad=new Request(['operation'=>'snapshot','run'=>'123']);$bad->headers['x-uid-signature']=str_repeat('0',64);
check(is_wp_error(uid_deploy_authorize($bad)),'invalid signature refused');
$stale=new Request(['operation'=>'snapshot','run'=>'123']);$stale->headers['x-uid-time']=(string)(time()-600);
check(is_wp_error(uid_deploy_authorize($stale)),'expired timestamp refused');
$valid=new Request(['operation'=>'snapshot','run'=>'123']);
check(uid_deploy_authorize($valid)===true,'first nonce accepted');
check(is_wp_error(uid_deploy_authorize($valid)),'replayed nonce refused');

uid_queue_rebuild();
check(count(uid_deploy_pending())===1,'relevant edit enters persistent outbox');
uid_dispatch_outbox();
check($GLOBALS['http_calls']===1 && count(uid_deploy_pending())===1,'failed dispatch retains content');
uid_deploy_status(['nextAttempt'=>0]);$GLOBALS['http_code']=204;
uid_dispatch_outbox();
check($GLOBALS['http_calls']===2 && count(uid_deploy_pending())===1,'accepted dispatch does not acknowledge content');
uid_dispatch_outbox();check($GLOBALS['http_calls']===2,'accepted dispatch is throttled while waiting');
$snapshot=request('snapshot');check(is_array($snapshot) && isset($snapshot['token']),'snapshot created');
$new=UID_STATE_DIR.'/pending-'.wp_generate_uuid4().'.json';file_put_contents($new,'{}');
request('fail',$snapshot['token']);check(count(uid_deploy_pending())===2,'build failure retains all edits');
$wrong=request('ack',$snapshot['token'],'999');check(is_wp_error($wrong),'another run cannot acknowledge this snapshot');
request('ack',$snapshot['token']);
check(count(uid_deploy_pending())===1 && is_file($new),'acknowledgement preserves edits arriving during build');
request('ack',$snapshot['token']);check(count(uid_deploy_pending())===1,'acknowledgement is idempotent');
$status=json_decode(file_get_contents(UID_STATE_DIR.'/deployment-status.json'),true);
check($status['state']==='DEV publié' && isset($status['lastSuccess']),'successful publication recorded');
$GLOBALS['site']='https://fanfareuid.ch/wordpress';
check(!uid_deploy_is_dev(),'production WordPress cannot dispatch DEV');
$before=$GLOBALS['http_calls'];uid_deploy_status(['nextAttempt'=>0]);uid_dispatch_outbox();
check($GLOBALS['http_calls']===$before,'no GitHub call from production');
check(is_wp_error(uid_deploy_authorize(new Request(['operation'=>'snapshot','run'=>'123']))),'production rejects deployment endpoint');
echo "PHP deployment contracts: OK\n";
