addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const { method, url } = request
  const { pathname } = new URL(url)

  // 处理静态文件请求
  if (pathname === '/' || pathname === '/index.html') {
    return new Response(getHTML(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  // 处理API请求
  if (pathname.startsWith('/api/notes')) {
    if (method === 'GET') {
      return getNotes()
    } else if (method === 'POST') {
      return createNote(request)
    } else if (method === 'PUT') {
      return updateNote(request)
    } else if (method === 'DELETE') {
      return deleteNote(request)
    }
  }

  return new Response('Not Found', { status: 404 })
}

// 获取所有笔记
async function getNotes() {
  try {
    const notes = await NOTES_KV.list()
    const notesData = []
    
    for (const key of notes.keys) {
      const note = await NOTES_KV.get(key.name, { type: 'json' })
      notesData.push(note)
    }

    return new Response(JSON.stringify(notesData), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch notes' }), { status: 500 })
  }
}

// 创建新笔记
async function createNote(request) {
  try {
    const body = await request.json()
    const { title, content } = body
    const id = crypto.randomUUID()
    const date = new Date().toISOString().split('T')[0]
    
    const note = {
      id,
      title,
      content,
      date,
      summary: content.length > 100 ? content.slice(0, 100) + '...' : content
    }

    await NOTES_KV.put(id, JSON.stringify(note))
    
    return new Response(JSON.stringify(note), {
      headers: { 'Content-Type': 'application/json' },
      status: 201
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create note' }), { status: 500 })
  }
}

// 更新笔记
async function updateNote(request) {
  try {
    const body = await request.json()
    const { id, title, content } = body
    
    const existingNote = await NOTES_KV.get(id, { type: 'json' })
    if (!existingNote) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    const updatedNote = {
      ...existingNote,
      title,
      content,
      summary: content.length > 100 ? content.slice(0, 100) + '...' : content
    }

    await NOTES_KV.put(id, JSON.stringify(updatedNote))
    
    return new Response(JSON.stringify(updatedNote), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update note' }), { status: 500 })
  }
}

// 删除笔记
async function deleteNote(request) {
  try {
    const body = await request.json()
    const { id } = body
    
    const existingNote = await NOTES_KV.get(id)
    if (!existingNote) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    await NOTES_KV.delete(id)
    
    return new Response(JSON.stringify({ success: true }))
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete note' }), { status: 500 })
  }
}

// 前端HTML
function getHTML() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>网络记事本</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  </style>
</head>
<body class="bg-gray-100 min-h-screen p-4">
  <div class="max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-4">网络记事本</h1>
    
    <!-- 新增按钮 -->
    <button id="addNoteBtn" class="mb-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
      新增笔记
    </button>

    <!-- 笔记列表 -->
    <div id="notesList" class="space-y-4"></div>

    <!-- 模态框 -->
    <div id="noteModal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <h2 id="modalTitle" class="text-lg font-bold mb-4"></h2>
        <form id="noteForm">
          <input id="noteId" type="hidden">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">标题</label>
            <input id="noteTitle" type="text" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">内容</label>
            <textarea id="noteContent" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" rows="4" required></textarea>
          </div>
          <div class="flex justify-end space-x-2">
            <button type="button" id="cancelBtn" class="px-4 py-2 bg-gray-300 rounded">取消</button>
            <button type="submit" id="saveBtn" class="px-4 py-2 bg-blue-500 text-white rounded">保存</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <script>
    async function fetchNotes() {
      const response = await fetch('/api/notes')
      const notes = await response.json()
      const notesList = document.getElementById('notesList')
      notesList.innerHTML = ''
      
      notes.forEach(note => {
        const noteElement = document.createElement('div')
        noteElement.className = 'bg-white p-4 rounded shadow flex justify-between items-start'
        noteElement.innerHTML = `
          <div class="flex-1">
            <h3 class="text-lg font-semibold">${note.title}</h3>
            <p class="text-sm text-gray-500">${note.date}</p>
            <p class="truncate cursor-pointer" onclick="viewNote('${note.id}')">${note.summary}</p>
            <div class="mt-2">
              <button onclick="editNote('${note.id}')" class="text-blue-500 mr-2">编辑</button>
              <button onclick="deleteNote('${note.id}')" class="text-red-500">删除</button>
            </div>
          </div>
        `
        notesList.appendChild(noteElement)
      })
    }

    function showModal(title, note = { id: '', title: '', content: '' }) {
      document.getElementById('modalTitle').textContent = title
      document.getElementById('noteId').value = note.id
      document.getElementById('noteTitle').value = note.title
      document.getElementById('noteContent').value = note.content
      document.getElementById('noteModal').classList.remove('hidden')
    }

    async function viewNote(id) {
      const response = await fetch('/api/notes')
      const notes = await response.json()
      const note = notes.find(n => n.id === id)
      showModal('查看笔记', note)
      document.getElementById('saveBtn').classList.add('hidden')
    }

    async function editNote(id) {
      const response = await fetch('/api/notes')
      const notes = await response.json()
      const note = notes.find(n => n.id === id)
      showModal('编辑笔记', note)
      document.getElementById('saveBtn').classList.remove('hidden')
    }

    async function deleteNote(id) {
      if (confirm('确定要删除这篇笔记吗？')) {
        await fetch('/api/notes', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        })
        fetchNotes()
      }
    }

    document.getElementById('addNoteBtn').addEventListener('click', () => {
      showModal('新增笔记')
      document.getElementById('saveBtn').classList.remove('hidden')
    })

    document.getElementById('cancelBtn').addEventListener('click', () => {
      document.getElementById('noteModal').classList.add('hidden')
      document.getElementById('noteForm').reset()
    })

    document.getElementById('noteForm').addEventListener('submit', async (e) => {
      e.preventDefault()
      const id = document.getElementById('noteId').value
      const title = document.getElementById('noteTitle').value
      const content = document.getElementById('noteContent').value
      
      const method = id ? 'PUT' : 'POST'
      await fetch('/api/notes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title, content })
      })
      
      document.getElementById('noteModal').classList.add('hidden')
      document.getElementById('noteForm').reset()
      fetchNotes()
    })

    // 初始化加载笔记
    fetchNotes()
  </script>
</body>
</html>
  `
}
