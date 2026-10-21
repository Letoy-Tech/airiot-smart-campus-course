"""Local-only guard tests; no SSH, service or database operation is allowed."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
from deployment_config import load_config, validate_remote_config


def module(filename, name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / filename)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


def remote_config():
    return {
        'expected_hostname': 'owned-test-host',
        'public_host': 'campus.example.test',
        'upload_user': 'course_deploy',
        'mysql_image': 'mysql@sha256:' + 'a' * 64,
        'airiot_base_url': 'https://gateway.example.test/rest',
        'shared_compose_project': '',
        'shared_entries': [],
    }


class DeploymentGuardTests(unittest.TestCase):
    def test_shipped_example_is_not_executable(self):
        example = SCRIPTS.parent / 'configuration/deployment.example.json'
        with self.assertRaises(RuntimeError):
            load_config(example)

    def test_no_implicit_ssh_target(self):
        deploy = module('campus-demo-deploy.py', 'test_deploy_unconfigured')
        with patch('subprocess.run', side_effect=AssertionError('No process may start')):
            with self.assertRaises(RuntimeError):
                deploy.ssh('true')
            with self.assertRaises(RuntimeError):
                deploy.upload(Path('candidate'), '/tmp/candidate')

    def test_placeholder_host_rejected(self):
        value = remote_config()
        value['public_host'] = 'demo.example.invalid'
        with self.assertRaises(RuntimeError):
            validate_remote_config(value)

    def test_http_requires_loopback(self):
        value = remote_config()
        value['airiot_base_url'] = 'http://gateway.example.test/rest'
        with self.assertRaises(RuntimeError):
            validate_remote_config(value)
        value['airiot_base_url'] = 'http://127.0.0.1:8080/rest'
        self.assertEqual(validate_remote_config(value)['airiot_base_url'], value['airiot_base_url'])

    def test_url_credentials_rejected(self):
        for value in ['https://user:synthetic@gateway.example.test/rest',
                      'https://gateway.example.test/rest?token=synthetic']:
            config = remote_config()
            config['airiot_base_url'] = value
            with self.assertRaises(RuntimeError):
                validate_remote_config(config)

    def test_image_must_be_immutable_and_not_example(self):
        for image in ['mysql:8.4', 'mysql@sha256:' + '0' * 64]:
            value = remote_config()
            value['mysql_image'] = image
            with self.assertRaises(RuntimeError):
                validate_remote_config(value)

    def test_no_implicit_shared_inventory(self):
        config = validate_remote_config(remote_config())
        self.assertEqual(config['shared_entries'], [])
        self.assertEqual(config['shared_compose_project'], '')

    def test_explicit_ssh_config_without_connecting(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary)
            (path / 'ssh-config').write_text('Host owned-test\n  HostName 192.0.2.1\n')
            value = {**remote_config(), 'ssh_host': 'owned-test', 'ssh_config': str(path / 'ssh-config')}
            (path / 'deployment.json').write_text(json.dumps(value))
            with patch('subprocess.run', side_effect=AssertionError('No process may start')):
                loaded = load_config(path / 'deployment.json')
            self.assertEqual(loaded['ssh_host'], 'owned-test')

    def test_wrong_target_hostname_stops_before_commands(self):
        host = module('campus-demo-host.py', 'test_host_wrong_target')
        args = ['campus-demo-host.py', 'verify', '--config-json', json.dumps(remote_config())]
        with patch.object(sys, 'argv', args), patch('os.geteuid', return_value=0), \
                patch('socket.gethostname', return_value='different-target'), \
                patch('subprocess.run', side_effect=AssertionError('No process may start')):
            with self.assertRaisesRegex(RuntimeError, 'Host/root contract mismatch'):
                host.main()

    def test_parts_can_be_reassembled_without_external_tools(self):
        deploy = module('campus-demo-deploy.py', 'test_deploy_parts')
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary)
            content = b'public-source-artifact' * 21
            (path / 'source.jar').write_bytes(content)
            with patch('subprocess.run', side_effect=AssertionError('No external tool is needed')):
                deploy.prepare_parts(path / 'source.jar', path / 'parts-dir', part_size=32)
            rows = (path / 'parts-dir/parts.manifest.tsv').read_text().splitlines()
            assembled = b''.join((path / 'parts-dir/parts' / row.split('\t')[0]).read_bytes() for row in rows)
            self.assertEqual(assembled, content)

    def test_remote_units_use_configured_image_and_keep_loopback(self):
        host = module('campus-demo-host.py', 'test_host_units')
        host.configure(remote_config())
        units = host.units()
        self.assertIn(remote_config()['mysql_image'], units[host.MYSQL])
        self.assertIn('--bind-address=127.0.0.1', units[host.MYSQL])
        self.assertNotIn('example.invalid', '\n'.join(units.values()))


if __name__ == '__main__':
    unittest.main()
