/***************************************************
                    System wide 
 ***************************************************/


// --------- Dark mode settings

function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const icon = document.querySelector('#navbar-right-cosmetics img[onclick="toggleDarkMode()"]');
    if (document.body.classList.contains('dark')) {
        if (icon) {
            icon.src = 'img/themes/default/darkmode.svg';
        }
        saveSetting('darkMode', true);
    } else {
        if (icon) {
            icon.src = 'img/themes/default/lightmode.svg';
        }
        saveSetting('darkMode', false);
    }
}


// ------------- Cosmetic menu toggle
function showCosmetics() {
  document.getElementById('navbar-right-cosmetics').classList.toggle('show');
}


// ------------- Accent colors toggle
const accentColors = {
  black: { light: '#1a1a1a', neon: '#ffffff' },
  blue: { light: '#1e40af', neon: '#60a5fa' },
  red: { light: '#b91c1c', neon: '#f87171' },
  yellow: { light: '#e6c229', neon: '#fde047' },
  green: { light: '#15803d', neon: '#4ade80' },
  purple: { light: '#6b21a8', neon: '#c084fc' },
  pink: { light: '#be185d', neon: '#f472b6' },
  orange: { light: '#c2410c', neon: '#fb923c' }
};

function toggleAccentPicker() {
  const picker = document.getElementById('accent-picker');
  if (picker) {
    picker.classList.toggle('show');
  }
}

function setAccentColor(color) {
  const c = accentColors[color];
  document.body.setAttribute('accent', color);
  document.documentElement.style.setProperty('--accent-light', c.light);
  document.documentElement.style.setProperty('--accent-neon', c.neon);

  document.querySelectorAll('.accent-option').forEach(opt => {
    opt.classList.toggle('active', opt.getAttribute('color') === color);
  });
  
  // Save the accent color preference
  saveSetting('accentColor', color);
  
  const picker = document.getElementById('accent-picker');
  if (picker) {
    picker.classList.remove('show');
  }
}
// Close picker on outside click
document.addEventListener('click', (e) => {
  const picker = document.getElementById('accent-picker');
  const btn = document.querySelector('img[onclick="toggleAccentPicker()"]');
  if (picker && btn && !picker.contains(e.target) && e.target !== btn) {
    picker.classList.remove('show');
  }
});









/***************************************************
                Navigation 
***************************************************/

// Initialize navigation tooltips
function initNavTooltips() {
  const navItems = document.querySelectorAll('#navbar-links li');
  
  navItems.forEach(item => {
    const link = item.querySelector('a');
    const tooltip = item.querySelector('.nav-tooltip');
    
    if (link && tooltip) {
      // Show tooltip on hover
      link.addEventListener('mouseenter', function() {
        if (window.innerWidth > 768) { // Only on desktop
          tooltip.style.opacity = '1';
          tooltip.style.transform = 'translateY(0)';
        }
      });
      
      // Hide tooltip when not hovering
      link.addEventListener('mouseleave', function() {
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(10px)';
      });
      
      // Hide tooltip on touch devices after tap
      link.addEventListener('touchstart', function() {
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(10px)';
      });
    }
  });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  initNavTooltips();
});

// Re-initialize when window is resized (in case of orientation change)
window.addEventListener('resize', initNavTooltips);




// ------------- [ Data base ] ----------------//


let db;
const dbName = 'Study DataBase';

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 3); // Increment to version 3

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
      if (!db.objectStoreNames.contains('todos')) {
        const todoStore = db.createObjectStore('todos', { keyPath: 'id', autoIncrement: true });
        // Create index for dueDate to query todos by date
        todoStore.createIndex('dueDate', 'dueDate', { unique: false });
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
  if (!db) return;
  const transaction = db.transaction(['settings'], 'readwrite');
  const store = transaction.objectStore('settings');
  store.put({ key, value });
}

function getSetting(key) {
  return new Promise((resolve) => {
    if (!db) {
      resolve(null);
      return;
    }
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => resolve(null);
  });
}













/***************************************************
                   Home PAGE
 ***************************************************/

// Notes functionality
if (document.getElementById('notesArea')) {
  const notesArea = document.getElementById('notesArea');
  
  // Load notes from IndexedDB on page load
  initDB().then(async () => {
    const savedNotes = await getSetting('notes');
    if (savedNotes) {
      notesArea.value = savedNotes;
    }
  });
  
  // Auto-save notes every 2 seconds
  let notesTimeout;
  notesArea.addEventListener('input', function() {
    clearTimeout(notesTimeout);
    notesTimeout = setTimeout(() => {
      saveSetting('notes', notesArea.value);
    }, 2000);
  });
}

function saveNotes() {
  const notesArea = document.getElementById('notesArea');
  const text = notesArea.value;
  
  // Create blob and download
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notes_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadNotes() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt';
  
  input.addEventListener('change', function() {
    const file = input.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const notesArea = document.getElementById('notesArea');
        notesArea.value = e.target.result;
        saveSetting('notes', e.target.result);
      };
      reader.readAsText(file);
    }
  });
  
  input.click();
}


/***************************************************
                HOME PAGE WIDGETS
***************************************************/

// Mini Todo Display
async function loadMiniTodos() {
  if (!document.getElementById('miniTodoList')) return;
  
  const todos = await getAllTodosFromDB();
  const miniList = document.getElementById('miniTodoList');
  
  if (todos.length === 0) {
    miniList.innerHTML = '<li style="list-style:none; text-align:center; opacity:0.5;">No tasks yet</li>';
    return;
  }
  
  miniList.innerHTML = '';
  todos.slice(0, 5).forEach(todo => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="checkbox"></div>
      <span>${todo.text}</span>
    `;
    
    li.addEventListener('click', async function() {
      await deleteTodoFromDB(todo.id);
      loadMiniTodos();
    });
    
    miniList.appendChild(li);
  });
}


// Initialize on home page
if (document.getElementById('calendarGrid')) {
  initDB().then(() => {
    loadMiniTodos();
    loadMiniCalendar();
  });
}
// Mini Calendar
async function loadMiniCalendar() {
  if (!document.getElementById('calendarGrid')) return;
  
  const grid = document.getElementById('calendarGrid');
  const monthTitle = document.getElementById('miniCalendarMonth');
  const popup = document.getElementById('calendarPopup');
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  monthTitle.textContent = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Get all todos for this month
  const allTodos = await getAllTodosFromDB();
  const todosWithDates = allTodos.filter(t => t.dueDate);
  
  grid.innerHTML = '';
  
  // Day headers
  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(day => {
    const header = document.createElement('div');
    header.className = 'cal-day cal-header';
    header.textContent = day;
    grid.appendChild(header);
  });
  
  // Empty cells
  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(document.createElement('div'));
  }
  
  // Days
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'cal-day';
    dayEl.textContent = day;
    
    const currentDate = new Date(year, month, day);
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Check if this date has todos
    const dayTodos = todosWithDates.filter(t => t.dueDate === dateStr);
    
    if (dayTodos.length > 0) {
      dayEl.classList.add('has-todos');
      dayEl.addEventListener('click', function() {
        showTodosPopup(dateStr, dayTodos);
      });
    }
    
    if (day === today.getDate()) {
      dayEl.classList.add('today');
    }
    
    grid.appendChild(dayEl);
  }
  
  // Close popup when clicking outside
  document.addEventListener('click', function(e) {
    if (popup && !popup.contains(e.target) && !e.target.classList.contains('has-todos')) {
      popup.classList.remove('show');
    }
  });
}

function showTodosPopup(dateStr, todos) {
  const popup = document.getElementById('calendarPopup');
  const popupDate = document.getElementById('popupDate');
  const popupTodos = document.getElementById('popupTodos');
  
  const date = new Date(dateStr);
  popupDate.textContent = date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
  
  popupTodos.innerHTML = '';
  todos.forEach(todo => {
    const li = document.createElement('li');
    li.textContent = todo.text;
    li.addEventListener('click', async function() {
      await deleteTodoFromDB(todo.id);
      popup.classList.remove('show');
      loadMiniTodos();
      loadMiniCalendar();
    });
    popupTodos.appendChild(li);
  });
  
  popup.classList.add('show');
}

/* ================================
   MUSIC PLAYER
   ================================ */

let isPlaying = false;
let isShuffle = false;
let repeatMode = 0;
let currentMusicIndex = 0;
let audio = new Audio();
let playlist = [];
let shuffleQueue = [];
let shufflePosition = 0;

// Check if music player elements exist on this page
if (document.getElementById('repeat')) {
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
}

if (document.getElementById('shuffle')) {
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
}

if (document.getElementById('play/pause')) {
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
}

if (document.getElementById('previous')) {
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
        currentMusicIndex = shuffleQueue[shufflePosition];
      } else {
        // Loop back to end
        shufflePosition = shuffleQueue.length - 1;
        currentMusicIndex = shuffleQueue[shufflePosition];
      }
    } else {
      currentMusicIndex = (currentMusicIndex - 1 + playlist.length) % playlist.length;
    }

    loadAndPlay(currentMusicIndex);
  });
}

if (document.getElementById('next')) {
  // Next button
  document.getElementById('next').addEventListener('click', function() {
    if (playlist.length === 0) return;
    playNext();
  });
}


// Update progress bar
audio.addEventListener('timeupdate', function() {
  if (document.getElementById('museProgressBar')) {
    const progress = (audio.currentTime / audio.duration) * 100;
    document.getElementById('museProgressBar').style.width = progress + '%';

    // Update time display
    const current = formatTime(audio.currentTime);
    const duration = formatTime(audio.duration);
    document.getElementById('museTime').textContent = `${current} / ${duration}`;
  }
});

// Click to seek
if (document.getElementById('museProgress')) {
  document.getElementById('museProgress').addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
  });
}

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

    currentMusicIndex = shuffleQueue[shufflePosition];
    loadAndPlay(currentMusicIndex);
  } else {
    if (currentMusicIndex < playlist.length - 1) {
      currentMusicIndex++;
      loadAndPlay(currentMusicIndex);
    } else if (repeatMode === 1) {
      currentMusicIndex = 0;
      loadAndPlay(currentMusicIndex);
    } else {
      stopPlayback();
    }
  }
}

function loadAndPlay(index) {
  if (playlist.length === 0) return;

  currentMusicIndex = index;
  audio.src = URL.createObjectURL(playlist[index].file);
  document.getElementById('museTitle').textContent = playlist[index].name;

  const disc = document.querySelector('#musePlayer img');
  const btn = document.querySelector('#play\\/pause img');

  isPlaying = true;
  audio.play();
  disc.style.animationPlayState = 'running';
  btn.src = 'img/themes/default/pause.svg';

  highlightCurrentSong();
  saveSetting('currentIndex', currentMusicIndex);
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
    item.classList.remove('playing');
    if (i === currentMusicIndex) {
      item.classList.add('playing');
    }
  });
}


// play list add and delete

if (document.getElementById('upload')) {
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
        currentMusicIndex = 0;
        highlightCurrentSong();
      }

      if (isShuffle) generateShuffleQueue();
    });

    input.click();
  });
}

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

    // Single click selects the song
    document.querySelectorAll('#musePlaylist li').forEach(item => {
      item.classList.remove('delete-ready', 'playing');
    });
    this.classList.add('playing');
    
    // Update current music index when clicked
    currentMusicIndex = parseInt(this.dataset.index);
    highlightCurrentSong();
  });

  li.addEventListener('dblclick', function(e) {
    if (e.target.classList.contains('drag-handle')) return;
    if (editMode) return;
    
    // Double click plays the song
    loadAndPlay(parseInt(this.dataset.index));
    
    // Remove any delete-ready states
    document.querySelectorAll('#musePlaylist li').forEach(item => {
      item.classList.remove('delete-ready');
    });
  });

  setupDragAndDrop(li);
  document.getElementById('musePlaylist').appendChild(li);
}


//--------------load data
async function init() {
  await initDB();
  // Load saved accent color
  const savedAccent = await getSetting('accentColor') || 'black';
  setAccentColor(savedAccent);
  
  const darkMode = await getSetting('darkMode');
  if (darkMode) {
    document.body.classList.add('dark');
    const icon = document.querySelector('#navbar-right-cosmetics img[onclick="toggleDarkMode()"]');
    if (icon) {
      icon.src = 'img/themes/default/darkmode.svg';
    }
  }

  

  // Only initialize music player if on home page
  if (document.getElementById('musePlayer')) {
    isShuffle = await getSetting('shuffle') || false;
    if (isShuffle) {
      const shuffleImg = document.querySelector('#shuffle img');
      if (shuffleImg) {
        shuffleImg.style.opacity = '1';
      }
    }

    repeatMode = await getSetting('repeatMode') || 0;
    const repeatBtn = document.querySelector('#repeat img');
    if (repeatBtn) {
      if (repeatMode === 1) {
        repeatBtn.src = 'img/themes/default/repeatall.svg';
      } else if (repeatMode === 2) {
        repeatBtn.src = 'img/themes/default/repeatone.svg';
      }
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
      currentMusicIndex = Math.min(savedIndex, playlist.length - 1);
      document.getElementById('museTitle').textContent = playlist[currentMusicIndex].name;
      audio.src = URL.createObjectURL(playlist[currentMusicIndex].file);
      highlightCurrentSong();
    }

    if (isShuffle) generateShuffleQueue();
  }

  
}

init();


//----------------------TOOLBAR CONTROLS


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
    currentMusicIndex = Math.min(currentMusicIndex, playlist.length - 1);
    document.getElementById('museTitle').textContent = playlist[currentMusicIndex].name;
    audio.src = URL.createObjectURL(playlist[currentMusicIndex].file);
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


// Drag to reorder

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
        currentMusicIndex = i;
      }
    }
  });

  playlist = newPlaylist;
  if (isShuffle) generateShuffleQueue();
}











/***************************************************
                    Todo PAGE
 ***************************************************/

document.addEventListener('DOMContentLoaded', async function() {
  // Only run if we're on the todo page
  if (!document.getElementById('listItems')) return;

  await initDB();

  const todoList = document.getElementById('listItems');
  const newTodoInput = document.getElementById('newItem');
  const dueDateInput = document.getElementById('dueDate');
  const addBtn = document.getElementById('addItems');

  await renderTodos();

  addBtn.addEventListener('click', addTodo);
  newTodoInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addTodo();
  });

  async function addTodo() {
    const text = newTodoInput.value.trim();
    if (text) {
      const dueDate = dueDateInput.value || null;
      await saveTodoToDB(text, dueDate);
      await renderTodos();
      newTodoInput.value = '';
      dueDateInput.value = '';
      newTodoInput.focus();
    }
  }

async function renderTodos() {
  const todos = await getAllTodosFromDB();
  
  if (todos.length === 0) {
    todoList.innerHTML = `
      <div class="empty-state">
        <p>Add tasks to display them here</p>
      </div>
    `;
    // Update calendars even when empty
    if (window.loadMiniTodos) loadMiniTodos();
    if (window.loadMiniCalendar) loadMiniCalendar();
    return;
  }

  todoList.innerHTML = '';
  todos.forEach(todo => {
    const todoItem = document.createElement('li');
    todoItem.className = 'listItem';
    todoItem.dataset.id = todo.id;

    const dueDateDisplay = todo.dueDate 
      ? `<span class="todo-due-date">  Due date:  ${new Date(todo.dueDate).toLocaleDateString()}</span>` 
      : '';

    todoItem.innerHTML = `
      <span class="todo-text">${todo.text}${dueDateDisplay}</span>
      <input type="text" class="edit-input" value="${todo.text}">
      <div class="actions">
        <button class="btn edit-btn">Edit</button>
        <button class="btn save-btn">Save</button>
        <button class="btn delete-btn">Delete</button>
      </div>
    `;

    todoList.appendChild(todoItem);
  });

  // Add event listeners
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', toggleEdit);
  });

  document.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', saveEdit);
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', deleteTodo);
  });
  
  // Update both calendars after rendering
  if (window.loadMiniTodos) loadMiniTodos();
  if (window.loadMiniCalendar) loadMiniCalendar();
}

  function toggleEdit(e) {
    const todoItem = e.target.closest('.listItem');
    const todoText = todoItem.querySelector('.todo-text');
    const editInput = todoItem.querySelector('.edit-input');
    const editBtn = todoItem.querySelector('.edit-btn');
    const saveBtn = todoItem.querySelector('.save-btn');

    todoText.classList.toggle('editing');
    editInput.classList.toggle('active');
    editBtn.classList.toggle('active');
    saveBtn.classList.toggle('active');

    if (todoText.classList.contains('editing')) {
      editInput.focus();
      editInput.select();
    }
  }

  async function saveEdit(e) {
    const todoItem = e.target.closest('.listItem');
    const editInput = todoItem.querySelector('.edit-input');
    const id = parseInt(todoItem.dataset.id);

    const newText = editInput.value.trim();
    if (newText) {
      await updateTodoInDB(id, newText);
      await renderTodos();
    }
  }

  async function deleteTodo(e) {
    const todoItem = e.target.closest('.listItem');
    const id = parseInt(todoItem.dataset.id);

    await deleteTodoFromDB(id);
    await renderTodos();
    
    if (window.loadMiniTodos) loadMiniTodos();
    if (window.loadMiniCalendar) loadMiniCalendar();
  }
});


// IndexedDB functions for todos
function saveTodoToDB(text, dueDate = null) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['todos'], 'readwrite');
    const store = transaction.objectStore('todos');
    const request = store.add({ 
      text, 
      dueDate, 
      completed: false, 
      created: Date.now() 
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getTodosByDate(date) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['todos'], 'readonly');
    const store = transaction.objectStore('todos');
    const index = store.index('dueDate');
    const request = index.getAll(date);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllTodosFromDB() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['todos'], 'readonly');
    const store = transaction.objectStore('todos');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function updateTodoInDB(id, text) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['todos'], 'readwrite');
    const store = transaction.objectStore('todos');
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const todo = getRequest.result;
      todo.text = text;
      const updateRequest = store.put(todo);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = () => reject(updateRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

function deleteTodoFromDB(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['todos'], 'readwrite');
    const store = transaction.objectStore('todos');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}










/***************************************************
                    TIMETABLE PAGE
 ***************************************************/
document.addEventListener('DOMContentLoaded', async function() {
  if (!document.getElementById('timetableSection')) return;

  await initDB();

  let currentDate = new Date();
  let isMonthView = false;

  const weekViewBtn = document.getElementById('weekViewBtn');
  const monthViewBtn = document.getElementById('monthViewBtn');
  const prevBtn = document.getElementById('prevMonth');
  const nextBtn = document.getElementById('nextMonth');
  const titleEl = document.getElementById('calendarMonthYear');
  const weekContainer = document.getElementById('weekViewContainer');
  const monthContainer = document.getElementById('monthViewContainer');

  // Initialize
  await renderWeekView();
  await renderMonthView();

  // View toggle
  if (weekViewBtn) {
    weekViewBtn.addEventListener('click', function() {
      isMonthView = false;
      weekViewBtn.classList.add('active');
      monthViewBtn.classList.remove('active');
      weekContainer.style.display = 'block';
      monthContainer.style.display = 'none';
      renderWeekView();
    });
  }

  if (monthViewBtn) {
    monthViewBtn.addEventListener('click', function() {
      isMonthView = true;
      monthViewBtn.classList.add('active');
      weekViewBtn.classList.remove('active');
      weekContainer.style.display = 'none';
      monthContainer.style.display = 'block';
      renderMonthView();
    });
  }

  // Navigation
  if (prevBtn) {
    prevBtn.addEventListener('click', async function() {
      if (isMonthView) {
        currentDate.setMonth(currentDate.getMonth() - 1);
        await renderMonthView();
      } else {
        currentDate.setDate(currentDate.getDate() - 7);
        await renderWeekView();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', async function() {
      if (isMonthView) {
        currentDate.setMonth(currentDate.getMonth() + 1);
        await renderMonthView();
      } else {
        currentDate.setDate(currentDate.getDate() + 7);
        await renderWeekView();
      }
    });
  }

  // Week View
  async function renderWeekView() {
    const weekStart = getWeekStart(new Date(currentDate));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    titleEl.textContent = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

    const allTodos = await getAllTodosFromDB();
    const weekTodos = allTodos.filter(t => {
      if (!t.dueDate) return false;
      const todoDate = new Date(t.dueDate);
      return todoDate >= weekStart && todoDate <= weekEnd;
    });

    // Clear existing todos and highlights
    document.querySelectorAll('.week-todo-item').forEach(el => el.remove());
    document.querySelectorAll('.today-col').forEach(el => el.classList.remove('today-col'));

    // Highlight today's column
    const today = new Date();
    if (today >= weekStart && today <= weekEnd) {
      const todayDayOfWeek = today.getDay();
      const columnIndex = todayDayOfWeek === 0 ? 7 : todayDayOfWeek;
      
      const rows = document.querySelectorAll('#weekTableBody tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[columnIndex]) {
          cells[columnIndex].classList.add('today-col');
        }
      });
    }

    // Add todos to table
    weekTodos.forEach(todo => {
      const todoDate = new Date(todo.dueDate);
      const dayOfWeek = todoDate.getDay();
      
      const firstRow = document.querySelectorAll('#weekTableBody tr')[0];
      
      if (firstRow) {
        const cells = firstRow.querySelectorAll('td');
        const columnIndex = dayOfWeek === 0 ? 7 : dayOfWeek;
        const cell = cells[columnIndex];
        
        if (cell) {
          const todoEl = document.createElement('div');
          todoEl.className = 'week-todo-item';
          todoEl.textContent = todo.text;
          todoEl.addEventListener('click', async function() {
            if (confirm(`Complete "${todo.text}"?`)) {
              await deleteTodoFromDB(todo.id);
              renderWeekView();
              if (window.loadMiniCalendar) loadMiniCalendar();
            }
          });
          cell.appendChild(todoEl);
        }
      }
    });
  }

  // Month View
  async function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    titleEl.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();

    const allTodos = await getAllTodosFromDB();
    const monthTodos = allTodos.filter(t => {
      if (!t.dueDate) return false;
      const todoDate = new Date(t.dueDate);
      return todoDate.getMonth() === month && todoDate.getFullYear() === year;
    });

    const grid = document.getElementById('monthCalendarGrid');
    grid.innerHTML = '';

    // Day headers
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
      const header = document.createElement('div');
      header.className = 'month-cal-day-header';
      header.textContent = day;
      header.style.fontWeight = 'bold';
      header.style.textAlign = 'center';
      header.style.padding = '10px';
      grid.appendChild(header);
    });

    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
      const emptyDay = document.createElement('div');
      emptyDay.className = 'month-cal-day';
      grid.appendChild(emptyDay);
    }

    // Days of the month
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'month-cal-day';

      const dayNumber = document.createElement('div');
      dayNumber.className = 'month-cal-day-number';
      dayNumber.textContent = day;
      dayEl.appendChild(dayNumber);

      const currentDate = new Date(year, month, day);
      const dateStr = currentDate.toISOString().split('T')[0];

      // Check if today
      if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
        dayEl.classList.add('today');
      }

      // Get todos for this day
      const dayTodos = monthTodos.filter(t => t.dueDate === dateStr);
      
      if (dayTodos.length > 0) {
        dayEl.classList.add('has-todos-month');
        const todosContainer = document.createElement('div');
        todosContainer.className = 'month-cal-todos';
        
        dayTodos.forEach(todo => {
          const todoItem = document.createElement('div');
          todoItem.className = 'month-cal-todo-item';
          todoItem.textContent = todo.text;
          todoItem.title = todo.text;
          todoItem.addEventListener('click', async function(e) {
            e.stopPropagation();
            if (confirm(`Complete "${todo.text}"?`)) {
              await deleteTodoFromDB(todo.id);
              renderMonthView();
              if (window.loadMiniCalendar) loadMiniCalendar();
            }
          });
          todosContainer.appendChild(todoItem);
        });
        
        dayEl.appendChild(todosContainer);
      }

      grid.appendChild(dayEl);
    }
  }

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }
});


/***************************************************
                    ABOUT PAGE
 ***************************************************/


// -------- Text type effect and content ----------
document.addEventListener('DOMContentLoaded', () => {
  // Only run if we're on the about page
  if (!document.getElementById('aboutName')) return;

  // assign names, details, profile icons and fonts to different creators
  const users = [
    {
      name: " Arthur",
      info: "Our front-end master and experienced web developer.",
      image: "img/themes/default/user.svg",
      font: "default"
    },
    {
      name: " Raheem",
      info: "Our graphics connoisseur and amateur game developer.",
      image: "img/themes/default/user.svg",
      font: "pixel"
    },
    {
      name: " Pedrito",
      info: "Our javascript engineer and production specialist.",
      image: "img/themes/default/user.svg",
      font: "typewriter"
    },
    {
      name: " Kristano",
      info: "Our documentation scribe and layout organizer.",
      image: "img/themes/default/user.svg",
      font: "handwrite"
    }
  ];

  let currentAboutIndex = 0;
  let typewriterInterval = null;
  let titleInterval = null;


  // ------ Get fonts and html elements
  const nameEl = document.getElementById('aboutName');
  const infoEl = document.getElementById('aboutInfo');
  const imageEl = document.getElementById('userImage');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const titleEl = document.getElementById('teamTitle');

  const fonts = ['default', 'pixel', 'typewriter', 'handwrite'];
  let fontIndex = 0;


  // ------- function that handles typewriter effect for names
  function typeText(text, element, speed = 80) {
    if (typewriterInterval) clearInterval(typewriterInterval);
    element.textContent = '';
    let i = 0;
    typewriterInterval = setInterval(() => {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
      } else {
        clearInterval(typewriterInterval);
      }
    }, speed);
  }



  // -------- function that handles specifically the title's typewriter effect and its font rotation  

  // handles type effect
  function typeTitle(text, element, speed = 100) {
    if (titleInterval) clearInterval(titleInterval);
    element.textContent = '';
    let i = 0;
    titleInterval = setInterval(() => {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
      } else {
        clearInterval(titleInterval);

        // handles font rotation
        setInterval(() => {
          element.style.opacity = '0';
          setTimeout(() => {
            fontIndex = (fontIndex + 1) % fonts.length;
            element.style.fontFamily = fonts[fontIndex];
            element.style.opacity = '1';
          }, 500);
        }, 10000);
      }
    }, speed);
  }

  // Tracks active creator
  function displayUser(index) {
    const user = users[index];
    imageEl.src = user.image;
    typeText(user.name, nameEl);
    infoEl.textContent = user.info;
    nameEl.style.fontFamily = user.font;
  }

  // buttons to go to the next and previous creator
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentAboutIndex = (currentAboutIndex - 1 + users.length) % users.length;
      displayUser(currentAboutIndex);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentAboutIndex = (currentAboutIndex + 1) % users.length;
      displayUser(currentAboutIndex);
    });
  }

  // displays title text and active creator
  if (titleEl) {
    typeTitle("Our Team", titleEl);
  }
  displayUser(currentAboutIndex);
});


