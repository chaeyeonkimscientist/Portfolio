(function () {
  const dock = document.getElementById('lp-dock');
  if (!dock) return;
  if (document.body.getAttribute('data-has-lp') === 'true') {
    dock.hidden = false;
  }
})();
