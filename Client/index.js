const tablesEl = document.getElementById('tablesHolder');
const createTableFormEl = document.getElementById('createTableForm');

function addTable(name, id) {
  tablesEl.innerHTML += `<tr><td>${name || `Table ${id}`}</td><td><button onclick="joinTable(${id});">join</button></td></tr>`;
}

function joinTable(id) {
  window.location = `${window.location.origin}/table.htm?id=${id}`;
}

async function postData(url = '', data = {}) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json'
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  });
  return response.json(); // parses JSON response into native JavaScript objects
}

createTableFormEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(event.target);
    let query = '';
    let tableName = '';
    for (const [name, val] of formData.entries()) {
      query += `${encodeURIComponent(name)}=${encodeURIComponent(val)}`
      if (name == 'name') {
        tableName = val;
      }
    }
    const response = await postData(`board/create?${query}`);
    console.log(`board/create?${query}`);
    if (response.success !== true) {
      throw new Error(`Table creation request failed with reason ${response.reason}`);
    }
    joinTable(response.id);
  } catch (err) {
    console.error(err);
  } 
});

async function updateBoards() {
  console.log('requesting');
  const response = await fetch('/boards');
  console.log(response);
  if (response.ok !== true) {
    console.error('unable to update boards list - invalid response');
    return;
  }
  const data = await response.json();
  console.log(data);
  tablesEl.innerHTML = '';
  data.forEach(([serwer, tables]) => {
    tables.forEach((tableId) => {
      addTable('', tableId);
    });
  });
}

updateBoards();
setInterval(updateBoards, 10000);