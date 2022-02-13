const params = new URLSearchParams(window.location.search);
const next = params.get('next');

document.getElementById('box').innerHTML +=
    `<a href='register.htm${next?.length > 0 ? `?next=${next}` : ''}'>Don't have account? Register</a>`;

async function postData(url = '', data = {}) {
  const formBody = [];
  for (const [key, val] of Object.entries(data)) {
    formBody.push(encodeURIComponent(key) + "=" + encodeURIComponent(val));
  }
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin !!!!!!!!!!!!
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      //'content-type': 'application/json'
      // 'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: formBody.join("&") // body data type must match "Content-Type" header
  });
  return response;
}

function goToIndex() {
  //window.location = window.location.origin + '/index.htm';
}

function retry() {
  document.getElementById('loginForm').reset();
  document.getElementById('loginForm').classList.add('invalid');
}
document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(event.target);
    let data = {};
    for (const [name, val] of formData.entries()) {
      data[name] = val;
    }
    const response = await postData(`/auth/login`, data);
    console.log(response);
    if (response.status === 200) {
      goToIndex();
    } else {
      try {
        const data = await response.json();
        console.log(data);
        const message = data?.detail ?? 'Unknown reason';
        alert(message);
      } catch (err) {
        throw new Error(`Register failed with unknown reason`);
      }
      retry();
    }
  } catch (err) {
    console.error(err);
  }
})