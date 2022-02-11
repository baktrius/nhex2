const params = new URLSearchParams(window.location.search);
const next = params.get('next');

document.body.innerHTML += `<a href='register.htm${next?.length > 0 ? `?next=${next}` : ''}'>Don't have account? Register</a>`;