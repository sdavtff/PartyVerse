/* global localStorage, document */
// Aplica o tema salvo antes de desenhar a página (evita piscar). Arquivo separado por causa da CSP.
try {
  var t = JSON.parse(localStorage.getItem('pv:prefs') || '{}').theme;
  if (t === 'light') {
    document.documentElement.dataset.theme = 'light';
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = '#f7f4fc';
  }
} catch {
  /* sem armazenamento: tema escuro */
}
