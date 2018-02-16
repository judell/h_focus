var groups = {}

var usersForUrl = [];

var annosForGroups;

function firstUser() {
  return usersForUrl[0];
}

function makeFrame(url, user) {

  var iframeUrl = `https://via.jonudell.info/${url}#annotations:query:user%3A${user}`;

  var frame = document.querySelector('#iframe');
  var container = document.querySelector('#container');
  container.removeChild(frame);
  
  frame = document.createElement('iframe');
  frame.setAttribute('id', 'iframe');
  frame.setAttribute('src', iframeUrl);
  container.appendChild(frame);

}

function makeUserList() {
  var userList = document.getElementById('userlist');
  userList.innerHTML = '';
  usersForUrl.forEach(function(user) {
    var option = document.createElement('option');
    option.value = user;
    option.innerText = user;
    userList.appendChild(option);
  });
}

function makeGroupList(groups) {
  var savedGroup = JSON.parse(localStorage.getItem('h_group'));
  var savedGroupId;
  if (savedGroup) {
    savedGroupId = savedGroup.id;
  }
  var groupList = document.getElementById('grouplist');
  groupList.innerHTML = '';
  groups.forEach(function(group) {

    var count = annosForGroups[group.id];

	if ( count ) {
      var option = document.createElement('option');
      option.value = group.id;
      if (group.id === savedGroupId) {
        option.selected = 1;
      }
      option.innerText = group.name + ' (' + count + ')';
      groupList.appendChild(option);
	}
  });
}


function makeForm() {
  var token = localStorage.getItem('h_token');
  var form = `

<div class="field">
<div class="info">url of an annotated document</div>
<input id="url" type="text" size="80" onchange="changeUrl()" value="http://example.com"></input>
</div>

<div class="field">
<div class="info">username</div>
<select id="userlist" onchange="changeUser()"></select>
</div>

<div class="field">
<div class="info">group</div>
<select id="grouplist" onchange="changeGroup()"></select>
</div>


<div class="field">
<div class="info">token <a class="small" target="_token" href="https://hypothes.is/account/developer">?</a></div>
<input type="password"  id="token" onchange="changeToken()" value="${token}"></input>
</div>

<div class="field">
<div class="info">link</a>
<div class="small"><a id="link" href="">use via or extension</a></div>
</div>
`;

  document.getElementById('form').innerHTML = form;
}

function makeHeaders() {
  return {
      Authorization: 'Bearer ' + getSavedToken(),
  }
}

function getFrame() {
  return document.getElementById('iframe');
}

function getUrl() {
  return document.getElementById('url').value;
}

function getUser() {
  var userList = document.getElementById('userlist');
  var index = userList.options.selectedIndex;
  if (index === -1) {
    return '';
  }
  return userList[index].value;
}

function getGroup() {
  var groupList = document.getElementById('grouplist');
  var index = groupList.options.selectedIndex;
  var group = grouplist[index];
  return {
    'id':group.value,
    'name':group.innerText,
  }
}

function getSavedGroup() {
  var group = JSON.parse(localStorage.getItem('h_group'));
  if (group) {
    setGroup(group.id);
    return {
      'id':group.id,
      'name':group.name,
    }
  }
  else {
    setGroup('__world__');
    return {
      'id':'__world__',
      'name':'Public',
    }
  }
}

function getSavedToken() {
  return localStorage.getItem('h_token');
}

function load(offset, url, users) {

  annosForGroups = defaultDict(function() { return 0; });

  if (! users ) {
    usersForUrl = [];
  }
  else {
    usersForUrl = users;
  }

  var encodedUri = encodeURIComponent(url);
  var apiCall = `https://hypothes.is/api/search?uri=${encodedUri}&limit=200&offset=${offset}`;

  var opts = {
    method:'GET',
    url:apiCall,
  }

  if ( getSavedToken() !== '' ) {
      opts.headers = makeHeaders();
  }

  http(opts).then(function(data) {

    var rows = JSON.parse(data).rows;
    rows.forEach(function(row) {
	  var group = row.group;
      if ( Object.keys(annosForGroups).indexOf(group) === -1 ) {
        annosForGroups[group] = 1;
	  }
	  else {
        annosForGroups[group] += 1;
      }
    });
    makeGroupList(groups);
    return true;

	}).then(function(annosForGroups) {

    var group = getSavedGroup().id;
    encodedUri = encodeURIComponent(url);
    apiCall = `https://hypothes.is/api/search?uri=${encodedUri}&limit=200&offset=${offset}&group=${group}`;
    opts.method = 'GET';
    opts.url = apiCall;

    http(opts).then(function(data) {
      var rows = JSON.parse(data).rows;
      rows.forEach(function(row) {
        var username = row.user.replace('acct:','').replace('@hypothes.is','');
        if ( usersForUrl.indexOf(username) == -1 ) {
          usersForUrl.push(username);
        }
      });
      usersForUrl.sort(compareUser);
      makeUserList();
      makeFrame(url, firstUser());
      setLink();
    });

  });
}

function setTitle(user, url) {
  document.querySelector('head title').innerText = `activity for ${user} on ${url}`;
}

function setLink() {
  var user = getUser();
  var url = getUrl();
  var link = `https://hyp.is/go?url=${url}&q=user:${user}`;
  document.getElementById('link').href = link;
  setTitle(user, url);
}

function changeUrl() {
  var url = getUrl();
  load(0, url);
  setLink();
}

function changeUser() {
  var url = getUrl();
  makeFrame(url, getUser());
  setLink();
}

function setGroup(groupId) {
  var targetWindow = document.getElementsByTagName('iframe')[0].contentWindow;
  targetWindow.postMessage('group:' + groupId, 'https://via.jonudell.info');
}

function changeGroup() {
  var group = getGroup();
  localStorage.setItem('h_group', JSON.stringify({'id':group.id, 'name':group.name}));
  var url = getUrl();
  load(0, url);
  setGroup(group.id);
}


function changeToken() {
 var token = document.getElementById('token').value;
 localStorage.setItem('h_token', token);
 localStorage.setItem('h_group', null);
 window.location.reload(true);
}

function compareUser(a,b) {
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

function http (opts) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open(opts.method, opts.url);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        resolve(xhr.response);
      } else {
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    if (opts.headers) {
      Object.keys(opts.headers).forEach(function (key) {
        xhr.setRequestHeader(key, opts.headers[key]);
      });
    }
    var params = opts.params;
    // We'll need to stringify if we've been given an object
    // If we have a string, this is skipped.
    if (params && typeof params === 'object') {
      params = Object.keys(params).map(function (key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      }).join('&');
    }
    xhr.send(params);
  });
}


// https://stackoverflow.com/questions/42235355/javascript-defaultdict-without-library

function defaultDict(createValue) {
    return new Proxy(Object.create(null), {
        get(storage, property) {
            if (!(property in storage))
                storage[property] = createValue(property);
            return storage[property];
        },
		set(storage, property, value) {
			storage[property] = value;
		}
    });
}

/*
var m = defaultdict(function() { return [] });
m["asdf"].push(0);
m["qwer"].push("foo");
Object.keys(m).forEach(console.log);
*/