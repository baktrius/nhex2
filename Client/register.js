const params = new URLSearchParams(window.location.search);
const next = params.get('next');

document.body.innerHTML += `<a href='login.htm${next?.length > 0 ? `?next=${next}` : ''}'>Login</a>`;