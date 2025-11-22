/* ================================
   DATABASE SETUP
   ================================ */

let db;
const dbName = 'musePlayerDB';

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(granted => {
        if (granted) {
          console.log("Storage will persist");
        } else {
          console.log("Storage may be cleared");
        }
      });
    }

    request.onupgradeneeded = (e) => {
      db = e.target.result;
      if (!db.objectStoreNames.contains('songs')) {
        db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

function saveSong(name, file) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['songs'], 'readwrite');
    const store = transaction.objectStore('songs');
    const request = store.add({ name, file });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteSong(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['songs'], 'readwrite');
    const store = transaction.objectStore('songs');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getAllSongs() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['songs'], 'readonly');
    const store = transaction.objectStore('songs');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveSetting(key, value) {
  const transaction = db.transaction(['settings'], 'readwrite');
  const store = transaction.objectStore('settings');
  store.put({ key, value });
}

function getSetting(key) {
  return new Promise((resolve) => {
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => resolve(null);
  });
}


/* ================================
   DARK MODE
   ================================ */

function toggleDarkMode() {
  document.body.classList.toggle('dark');
  const icon = document.querySelector('#navbar-right-cosmetics img[onclick="toggleDarkMode()"]');
  if (document.body.classList.contains('dark')) {
    icon.src = 'img/themes/default/darkmode.svg';
    saveSetting('darkMode', true);
  } else {
    icon.src = 'img/themes/default/lightmode.svg';
    saveSetting('darkMode', false);
  }
}


/* ================================
   COSMETICS MENU
   ================================ */

function showCosmetics() {
  document.getElementById('navbar-right-cosmetics').classList.toggle('show');
}


/* ================================
   MUSIC PLAYER
   ================================ */

let isPlaying = false;
let isShuffle = false;
let repeatMode = 0;
let currentIndex = 0;
let audio = new Audio();
let playlist = [];
let shuffleQueue = [];
let shufflePosition = 0;

// Repeat button
document.getElementById('repeat').addEventListener('click', function() {
  const btn = this.querySelector('img');
  repeatMode = (repeatMode + 1) % 3;

  if (repeatMode === 0) {
    btn.src = 'img/themes/default/repeat.svg';
  } else if (repeatMode === 1) {
    btn.src = 'img/themes/default/repeatall.svg';
  } else {
    btn.src = 'img/themes/default/repeatone.svg';
  }

  saveSetting('repeatMode', repeatMode);
});

// Shuffle button
document.getElementById('shuffle').addEventListener('click', function() {
  const btn = this.querySelector('img');
  isShuffle = !isShuffle;

  if (isShuffle) {
    btn.style.opacity = '1';
    generateShuffleQueue();
  } else {
    btn.style.opacity = '0.5';
    shuffleQueue = [];
    shufflePosition = 0;
  }

  saveSetting('shuffle', isShuffle);
});

document.querySelector('#shuffle img').style.opacity = '0.5';

// Play/Pause button
document.getElementById('play/pause').addEventListener('click', function() {
  if (playlist.length === 0) return;

  const disc = document.querySelector('#musePlayer img');
  const btn = this.querySelector('img');

  if (isPlaying) {
    isPlaying = false;
    audio.pause();
    disc.style.animationPlayState = 'paused';
    btn.src = 'img/themes/default/play.svg';
  } else {
    isPlaying = true;
    audio.play();
    disc.style.animationPlayState = 'running';
    btn.src = 'img/themes/default/pause.svg';
    highlightCurrentSong();
  }
});

// Previous button
document.getElementById('previous').addEventListener('click', function() {
  if (playlist.length === 0) return;

  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }

  if (isShuffle) {
    if (shufflePosition > 0) {
      shufflePosition--;
      currentIndex = shuffleQueue[shufflePosition];
    } else {
      // Loop back to end
      shufflePosition = shuffleQueue.length - 1;
      currentIndex = shuffleQueue[shufflePosition];
    }
  } else {
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
  }

  loadAndPlay(currentIndex);
});

// Next button
document.getElementById('next').addEventListener('click', function() {
  if (playlist.length === 0) return;
  playNext();
});


// Update progress bar
audio.addEventListener('timeupdate', function() {
  const progress = (audio.currentTime / audio.duration) * 100;
  document.getElementById('museProgressBar').style.width = progress + '%';
  
  // Update time display
  const current = formatTime(audio.currentTime);
  const duration = formatTime(audio.duration);
  document.getElementById('museTime').textContent = `${current} / ${duration}`;
});

// Click to seek
document.getElementById('museProgress').addEventListener('click', function(e) {
  const rect = this.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  audio.currentTime = percent * audio.duration;
});

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// When song ends
audio.addEventListener('ended', function() {
  if (repeatMode === 2) {
    audio.currentTime = 0;
    audio.play();
  } else {
    playNext();
  }
});

function playNext() {
  if (playlist.length === 0) return;

  if (isShuffle) {
    shufflePosition++;

    if (shufflePosition >= shuffleQueue.length) {
      // Reshuffle and loop
      generateShuffleQueue();
      shufflePosition = 0;
    }

    currentIndex = shuffleQueue[shufflePosition];
    loadAndPlay(currentIndex);
  } else {
    if (currentIndex < playlist.length - 1) {
      currentIndex++;
      loadAndPlay(currentIndex);
    } else if (repeatMode === 1) {
      currentIndex = 0;
      loadAndPlay(currentIndex);
    } else {
      stopPlayback();
    }
  }
}

function loadAndPlay(index) {
  if (playlist.length === 0) return;

  currentIndex = index;
  audio.src = URL.createObjectURL(playlist[index].file);
  document.getElementById('museTitle').textContent = playlist[index].name;

  const disc = document.querySelector('#musePlayer img');
  const btn = document.querySelector('#play\\/pause img');

  isPlaying = true;
  audio.play();
  disc.style.animationPlayState = 'running';
  btn.src = 'img/themes/default/pause.svg';

  highlightCurrentSong();
  saveSetting('currentIndex', currentIndex);
}

function stopPlayback() {
  const disc = document.querySelector('#musePlayer img');
  const btn = document.querySelector('#play\\/pause img');

  isPlaying = false;
  audio.pause();
  disc.style.animationPlayState = 'paused';
  btn.src = 'img/themes/default/play.svg';
}

function generateShuffleQueue() {
  shuffleQueue = [...Array(playlist.length).keys()];
  for (let i = shuffleQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffleQueue[i], shuffleQueue[j]] = [shuffleQueue[j], shuffleQueue[i]];
  }
  shufflePosition = 0;
}

function highlightCurrentSong() {
  const items = document.querySelectorAll('#musePlaylist li');
  items.forEach((item, i) => {
    if (i === currentIndex) {
      item.classList.add('playing');
    } else {
      item.classList.remove('playing');
    }
  });
}


/* ================================
   PLAYLIST UPLOAD & DELETE
   ================================ */

document.getElementById('upload').addEventListener('click', function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  input.multiple = true;

  input.addEventListener('change', async function() {
    for (const file of input.files) {
      const fileName = file.name.replace(/\.[^/.]+$/, '');

      const id = await saveSong(fileName, file);

      playlist.push({ id, name: fileName, file });
      const index = playlist.length - 1;

      createPlaylistItem(fileName, index, id);
    }

    document.getElementById('museLibrary').classList.add('show');
    document.querySelector('.Muse').classList.add('expanded');
    libraryVisible = true;

    if (playlist.length === input.files.length) {
      document.getElementById('museTitle').textContent = playlist[0].name;
      audio.src = URL.createObjectURL(playlist[0].file);
      currentIndex = 0;
      highlightCurrentSong();
    }

    if (isShuffle) generateShuffleQueue();
  });

  input.click();
});

function updateIndices() {
  document.querySelectorAll('#musePlaylist li').forEach((item, i) => {
    item.dataset.index = i;
  });
}

function checkPlaylistEmpty() {
  if (playlist.length === 0) {
    document.getElementById('museLibrary').classList.remove('show');
    document.querySelector('.Muse').classList.remove('expanded');
    libraryVisible = false;
    shuffleQueue = [];
    shufflePosition = 0;
  }
}

function createPlaylistItem(name, index, id) {
  const li = document.createElement('li');
  li.innerHTML = `
    <span class="checkbox"></span>
    <span class="song-name">${name}</span>
    <span class="drag-handle">⋮⋮</span>
  `;
  li.dataset.index = index;
  li.dataset.id = id;

  li.addEventListener('click', async function(e) {
    if (e.target.classList.contains('drag-handle')) return;

    if (editMode) {
      this.classList.toggle('selected');
      return;
    }

    if (this.classList.contains('delete-ready')) {
      const idx = parseInt(this.dataset.index);
      const songId = parseInt(this.dataset.id);

      await deleteSong(songId);
      playlist.splice(idx, 1);
      updateIndices();

      if (idx < currentIndex) {
        currentIndex--;
      } else if (idx === currentIndex) {
        if (playlist.length === 0) {
          document.getElementById('museTitle').textContent = 'Not Playing';
          stopPlayback();
        } else {
          currentIndex = Math.min(currentIndex, playlist.length - 1);
          loadAndPlay(currentIndex);
        }
      }

      this.remove();
      checkPlaylistEmpty();

      if (isShuffle) generateShuffleQueue();
    } else {
      document.querySelectorAll('#musePlaylist li').forEach(item => {
        item.classList.remove('delete-ready');
      });
      this.classList.add('delete-ready');
    }
  });

  li.addEventListener('dblclick', function(e) {
    if (e.target.classList.contains('drag-handle')) return;
    if (editMode) return;
    loadAndPlay(parseInt(this.dataset.index));
  });

  setupDragAndDrop(li);
  document.getElementById('musePlaylist').appendChild(li);
}


/* ================================
   LOAD SAVED DATA ON START
   ================================ */

async function init() {
  await initDB();

  const darkMode = await getSetting('darkMode');
  if (darkMode) {
    document.body.classList.add('dark');
    document.querySelector('#navbar-right-cosmetics img[onclick="toggleDarkMode()"]').src = 'img/themes/default/darkmode.svg';
  }

  isShuffle = await getSetting('shuffle') || false;
  if (isShuffle) {
    document.querySelector('#shuffle img').style.opacity = '1';
  }

  repeatMode = await getSetting('repeatMode') || 0;
  const repeatBtn = document.querySelector('#repeat img');
  if (repeatMode === 1) {
    repeatBtn.src = 'img/themes/default/repeat-all.svg';
  } else if (repeatMode === 2) {
    repeatBtn.src = 'img/themes/default/repeat-one.svg';
  }

  const songs = await getAllSongs();
  songs.forEach((song, index) => {
    playlist.push({ id: song.id, name: song.name, file: song.file });
    createPlaylistItem(song.name, index, song.id);
  });

  if (playlist.length > 0) {
    document.getElementById('museLibrary').classList.add('show');
    document.querySelector('.Muse').classList.add('expanded');
    libraryVisible = true;

    const savedIndex = await getSetting('currentIndex') || 0;
    currentIndex = Math.min(savedIndex, playlist.length - 1);
    document.getElementById('museTitle').textContent = playlist[currentIndex].name;
    audio.src = URL.createObjectURL(playlist[currentIndex].file);
    highlightCurrentSong();
  }

  if (isShuffle) generateShuffleQueue();
}

init();


/* ================================
   TOOLBAR CONTROLS
   ================================ */

let editMode = false;
let libraryVisible = false;

function toggleLibrary() {
  libraryVisible = !libraryVisible;
  if (libraryVisible && playlist.length > 0) {
    document.getElementById('museLibrary').classList.add('show');
    document.querySelector('.Muse').classList.add('expanded');
  } else {
    document.getElementById('museLibrary').classList.remove('show');
    document.querySelector('.Muse').classList.remove('expanded');
  }
}

function toggleEditMode() {
  editMode = !editMode;
  const editControls = document.getElementById('museEditControls');

  if (editMode) {
    editControls.classList.add('show');
    if (!libraryVisible && playlist.length > 0) {
      toggleLibrary();
    }
  } else {
    editControls.classList.remove('show');
    document.querySelectorAll('#musePlaylist li').forEach(item => {
      item.classList.remove('selected');
    });
  }
}

function selectAllSongs() {
  document.querySelectorAll('#musePlaylist li').forEach(item => {
    item.classList.add('selected');
  });
}

async function deleteSelected() {
  const selected = document.querySelectorAll('#musePlaylist li.selected');
  if (selected.length === 0) return;

  // Get all IDs first before modifying
  const toDelete = [];
  selected.forEach(li => {
    toDelete.push({
      id: parseInt(li.dataset.id),
      element: li
    });
  });

  // Delete from database and remove elements
  for (const item of toDelete) {
    await deleteSong(item.id);
    const song = playlist.find(s => s.id === item.id);
    if (song) {
      const idx = playlist.indexOf(song);
      playlist.splice(idx, 1);
    }
    item.element.remove();
  }

  updateIndices();

  if (playlist.length === 0) {
    document.getElementById('museTitle').textContent = 'Not Playing';
    stopPlayback();
    checkPlaylistEmpty();
    toggleEditMode();
  } else {
    currentIndex = Math.min(currentIndex, playlist.length - 1);
    document.getElementById('museTitle').textContent = playlist[currentIndex].name;
    audio.src = URL.createObjectURL(playlist[currentIndex].file);
    highlightCurrentSong();
  }

  if (isShuffle && playlist.length > 0) generateShuffleQueue();
}

async function clearPlaylist() {
  if (!confirm('Clear entire playlist?')) return;

  for (const song of playlist) {
    await deleteSong(song.id);
  }

  playlist = [];
  document.getElementById('musePlaylist').innerHTML = '';
  document.getElementById('museTitle').textContent = 'Not Playing';
  stopPlayback();
  checkPlaylistEmpty();
  shuffleQueue = [];
  shufflePosition = 0;
  toggleEditMode();
}


/* ================================
   DRAG TO REORDER
   ================================ */

let draggedItem = null;

function setupDragAndDrop(li) {
  li.draggable = true;

  li.addEventListener('dragstart', function(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  li.addEventListener('dragend', function() {
    this.classList.remove('dragging');
    draggedItem = null;
    updatePlaylistOrder();
  });

  li.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const bounding = this.getBoundingClientRect();
    const offset = e.clientY - bounding.top;

    if (offset > bounding.height / 2) {
      this.parentNode.insertBefore(draggedItem, this.nextSibling);
    } else {
      this.parentNode.insertBefore(draggedItem, this);
    }
  });
}

function updatePlaylistOrder() {
  const items = document.querySelectorAll('#musePlaylist li');
  const newPlaylist = [];

  items.forEach((item, i) => {
    const id = parseInt(item.dataset.id);
    const song = playlist.find(s => s.id === id);
    if (song) {
      newPlaylist.push(song);
      item.dataset.index = i;

      if (item.classList.contains('playing')) {
        currentIndex = i;
      }
    }
  });

  playlist = newPlaylist;
  if (isShuffle) generateShuffleQueue();
}
