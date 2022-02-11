const params = new URLSearchParams(window.location.search);
const next = params.get('next');

document.getElementById('box').innerHTML +=
    `<a href='register.htm${next?.length > 0 ? `?next=${next}` : ''}'>Don't have account? Register</a>`;

async function postData(url = '', data = {}) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin !!!!!!!!!!!!
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'content-type': 'application/json'
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  });
  return response;
}

function goToIndex() {
  window.location = window.location.origin + 'index.htm';
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
    data['email'] = 'fake@gmail.com';
    data['name'] = 'krzys';
    data['lastname'] = 'krzys';
    const response = await postData(`http://localhost:8001/auth/register`, data);
    console.log(response);
    if (response.status === 200) {
      goToIndex();
    } else if (response.status === 422) {
      retry();
    } else {
      throw new Error(`Login failed with unknown reason`);
    }
  } catch (err) {
    console.error(err);
  }
})