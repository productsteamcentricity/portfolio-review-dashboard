// Test entry that imports the vendored fixture: the build must inline it, ahead of the app script.
import Hello from 'vendor:hello';

document.body.dataset.vendor = Hello.greet();
const info = document.getElementById('build-info');
document.body.dataset.channel = info ? JSON.parse(info.textContent).channel : 'none';
