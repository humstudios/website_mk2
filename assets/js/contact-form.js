// Turnstile callback: called when the widget succeeds
window.enableSubmit = function(){
  try { document.getElementById('submit-button').disabled = false; } catch(e){}
};

// Accessible client-side validation
(function(){
  function setError(id, msg){
    var field = document.getElementById(id);
    var err = document.getElementById(id + '-error');
    if (!field || !err) return;
    if (msg){
      field.setAttribute('aria-invalid', 'true');
      err.textContent = msg;
      err.hidden = false;
    } else {
      field.removeAttribute('aria-invalid');
      err.textContent = '';
      err.hidden = true;
    }
  }
  function validate(){
    var ok = true;
    var name = document.getElementById('name'),
        email = document.getElementById('email'),
        message = document.getElementById('message');
    if (!name.value.trim()){ setError('name', 'Please enter your name.'); ok = false; } else setError('name');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())){ setError('email', 'Please enter a valid email.'); ok = false; } else setError('email');
    if (!message.value.trim()){ setError('message', 'Please enter a message.'); ok = false; } else setError('message');
    return ok;
  }
  function init(){
    var form = document.getElementById('contactForm');
    if (!form) return;
    form.addEventListener('submit', function(e){ if (!validate()) e.preventDefault(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
