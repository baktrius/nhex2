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

console.log('initiating boards updating');
updateBoards();
let updateService = setInterval(updateBoards, 5000)

// Set the name of the hidden property and the change event for visibility
let hidden, visibilityChange;
if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
  hidden = "hidden";
  visibilityChange = "visibilitychange";
} else if (typeof document.msHidden !== "undefined") {
  hidden = "msHidden";
  visibilityChange = "msvisibilitychange";
} else if (typeof document.webkitHidden !== "undefined") {
  hidden = "webkitHidden";
  visibilityChange = "webkitvisibilitychange";
}

// If the page is hidden, pause the video;
// if the page is shown, play the video
function handleVisibilityChange() {
  if (document[hidden]) {
    if (updateService !== undefined) {
      console.log('disabling boards updating');
      clearInterval(updateService);
      updateService = undefined;
    }
  } else {
    if (updateService === undefined) {
      console.log('initiating boards updating');
      updateBoards();
      updateService = setInterval(updateBoards, 5000)
    }
  }
}

// Warn if the browser doesn't support addEventListener or the Page Visibility API
if (typeof document.addEventListener === "undefined" || hidden === undefined) {
  console.log("This demo requires a browser, such as Google Chrome or Firefox, that supports the Page Visibility API.");
} else {
  // Handle page visibility change
  document.addEventListener(visibilityChange, handleVisibilityChange, false);

}