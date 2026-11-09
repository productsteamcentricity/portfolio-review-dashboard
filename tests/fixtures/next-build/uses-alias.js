// Test entry that imports only the alias of the fixture bundle: the build must inline the bundle (the file that
// defines the alias's global), ahead of the app script, and nothing else.
import Alias from 'vendor:alias';

document.body.dataset.vendor = Alias.name();
