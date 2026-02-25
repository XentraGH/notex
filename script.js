// ========== STATE ==========
let notes = [];
let currentNoteId = null;
let saveTimeout = null;

// ========== DOM ELEMENTS ==========
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('menuBtn');
const searchInput = document.getElementById('searchInput');
const notesList = document.getElementById('notesList');
const noteCount = document.getElementById('noteCount');

const editorView = document.getElementById('editorView');
const emptyView = document.getElementById('emptyView');
const noteTitleInput = document.getElementById('noteTitleInput');
const editor = document.getElementById('editor');
const saveStatus = document.getElementById('saveStatus');
const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');

const newNoteBtn = document.getElementById('newNoteBtn');
const emptyNewNoteBtn = document.getElementById('emptyNewNoteBtn');
const deleteBtn = document.getElementById('deleteBtn');
const copyBtn = document.getElementById('copyBtn');
const exportBtn = document.getElementById('exportBtn');

const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// ========== STORAGE ==========
function loadNotes() { notes = JSON.parse(localStorage.getItem('notex_app_notes') || '[]'); }
function saveNotesToStorage() { localStorage.setItem('notex_app_notes', JSON.stringify(notes)); }

// ========== APP INIT ==========
function initApp() {
    loadNotes();
    renderNotesList();
    notes.length > 0 ? selectNote(notes[0].id) : showEmptyView();
}

// ========== VIEWS ==========
function showEditorView() { editorView.classList.remove('hidden'); emptyView.classList.add('hidden'); }
function showEmptyView() { editorView.classList.add('hidden'); emptyView.classList.remove('hidden'); }

// ========== SIDEBAR ==========
function toggleSidebar() {
    sidebar.classList.toggle('-translate-x-full');
    sidebarOverlay.classList.toggle('hidden');
}

// ========== NOTES ==========
function createNewNote() {
    const note = { id: 'note-' + Date.now(), title: '', content: '', updatedAt: new Date().toISOString() };
    notes.unshift(note);
    saveNotesToStorage();
    renderNotesList();
    selectNote(note.id);
    noteTitleInput.focus();
    if (window.innerWidth < 1024) toggleSidebar();
}

function selectNote(id) {
    currentNoteId = id;
    const note = notes.find(n => n.id === id);
    if (note) {
        noteTitleInput.value = note.title;
        editor.innerHTML = note.content || '';
        updateCounts();
        renderNotesList();
        showEditorView();
    }
}

function deleteCurrentNote() {
    if (!currentNoteId) return;
    notes = notes.filter(n => n.id !== currentNoteId);
    saveNotesToStorage();
    currentNoteId = null;
    renderNotesList();
    notes.length > 0 ? selectNote(notes[0].id) : showEmptyView();
    showToast('Note deleted');
}

function renderNotesList(filter = '') {
    const filtered = filter ? notes.filter(n => n.title.toLowerCase().includes(filter.toLowerCase()) || (n.content || '').toLowerCase().includes(filter.toLowerCase())) : notes;
    noteCount.textContent = notes.length;

    if (filtered.length === 0) {
        notesList.innerHTML = `<div class="text-center py-10 text-muted px-4"><p class="text-sm">${filter ? 'No results' : 'No notes'}</p></div>`;
        return;
    }

    notesList.innerHTML = filtered.map((note, idx) => `
        <button class="note-item w-full text-left p-3 rounded-lg focus-ring slide-in ${note.id === currentNoteId ? 'active' : ''}" data-id="${note.id}">
            <div class="font-medium text-sm truncate">${note.title || 'Untitled'}</div>
            <div class="text-xs text-muted/70 mt-1">${formatDate(note.updatedAt)}</div>
        </button>
    `).join('');

    notesList.querySelectorAll('.note-item').forEach(btn => {
        btn.onclick = () => { selectNote(btn.dataset.id); if (window.innerWidth < 1024) toggleSidebar(); };
    });
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const diff = Math.floor((new Date() - date) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
    return date.toLocaleDateString();
}

// ========== AUTO-SAVE ==========
function triggerAutoSave() {
    if (!currentNoteId) return;
    saveStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-warning saving-pulse"></span><span class="text-warning">Saving...</span>';
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        const note = notes.find(n => n.id === currentNoteId);
        if (note) {
            note.title = noteTitleInput.value;
            note.content = editor.innerHTML;
            note.updatedAt = new Date().toISOString();
            saveNotesToStorage();
            renderNotesList(searchInput.value);
            saveStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-success"></span>All changes saved';
        }
    }, 500);
}

// ========== EDITOR ==========
function execCommand(cmd, val=null) {
    document.execCommand(cmd, false, val);
    editor.focus();
    triggerAutoSave();
}

function updateCounts() {
    const text = editor.innerText || '';
    charCount.textContent = `${text.length} characters`;
    wordCount.textContent = `${text.trim() ? text.trim().split(/\s+/).length : 0} words`;
}

// ========== EXPORT ==========
async function exportNote() {
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    const filename = (note.title || 'Untitled Note') + '.txt';
    const content = editor.innerText;

    // Use File System Access API if available (Nativefier/Electron/Modern Browsers)
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [
                    {
                        description: 'Text File',
                        accept: { 'text/plain': ['.txt'] },
                    },
                ],
            });
            
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            
            showToast(`Saved: ${handle.name}`);
        } catch (err) {
            // User cancelled or error
            if (err.name !== 'AbortError') {
                console.error(err);
                showToast('Save cancelled or failed');
            }
        }
    } else {
        // Fallback for browsers without File System Access API
        const blob = new Blob([content], {type: 'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`Saved: ${filename}`);
    }
}

// ========== TOAST ==========
function showToast(msg) {
    toastMessage.textContent = msg;
    toast.classList.remove('translate-y-24', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-24', 'opacity-0'), 3000);
}

// ========== EVENTS ==========
menuBtn.onclick = toggleSidebar;
sidebarOverlay.onclick = toggleSidebar;
newNoteBtn.onclick = createNewNote;
emptyNewNoteBtn.onclick = createNewNote;
deleteBtn.onclick = deleteCurrentNote;
copyBtn.onclick = () => { navigator.clipboard.writeText(editor.innerText); showToast('Copied to clipboard'); };
searchInput.oninput = (e) => renderNotesList(e.target.value);
noteTitleInput.oninput = triggerAutoSave;
editor.oninput = () => { updateCounts(); triggerAutoSave(); };

document.querySelectorAll('[data-command]').forEach(btn => {
    btn.onclick = () => execCommand(btn.dataset.command, btn.dataset.value);
});

exportBtn.onclick = exportNote;

document.onkeydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && document.activeElement === editor) {
        if (e.key === 'b') { e.preventDefault(); execCommand('bold'); }
        if (e.key === 'i') { e.preventDefault(); execCommand('italic'); }
        if (e.key === 'u') { e.preventDefault(); execCommand('underline'); }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); triggerAutoSave(); showToast('Note saved'); }
};

// ========== START ==========
document.addEventListener('DOMContentLoaded', initApp);