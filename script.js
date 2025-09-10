const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fetch entries
async function fetchEntries() {
  const { data, error } = await supabase.from('entries').select('*').order('date', { ascending: false });
  if(error) console.error(error);
  return data || [];
}

// Display entries
async function displayEntries(filter = '', sort = 'dateDesc') {
  let entries = await fetchEntries();
  let filtered = entries.filter(entry =>
    entry.title.toLowerCase().includes(filter) ||
    entry.description.toLowerCase().includes(filter) ||
    entry.tags.some(tag => tag.toLowerCase().includes(filter))
  );

  switch(sort) {
    case 'dateAsc': filtered.sort((a,b) => a.date - b.date); break;
    case 'dateDesc': filtered.sort((a,b) => b.date - a.date); break;
    case 'titleAsc': filtered.sort((a,b) => a.title.localeCompare(b.title)); break;
    case 'titleDesc': filtered.sort((a,b) => b.title.localeCompare(a.title)); break;
  }

  const entryList = document.getElementById('entryList');
  entryList.innerHTML = '';
  filtered.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `
      <h3>${entry.title}</h3>
      <p>${entry.description}</p>
      <div class="tags">Tags: ${entry.tags.map(t=>`<span onclick="filterByTag('${t}')">${t}</span>`).join(', ')}</div>
      ${entry.files.map((f,i)=>`<a href="#" onclick="openPDF('${f}')">View PDF ${i+1}</a>`).join('')}
    `;
    entryList.appendChild(div);
  });
}

// Upload PDF files
async function uploadFiles(files) {
  const urls = [];
  for(const file of files) {
    const { data, error } = await supabase.storage.from('pdfs').upload(`${Date.now()}-${file.name}`, file, { upsert: true });
    if(error) console.error(error);
    else urls.push(supabase.storage.from('pdfs').getPublicUrl(data.path).publicURL);
  }
  return urls;
}

// Add new entry
document.getElementById('entryForm').addEventListener('submit', async e => {
  e.preventDefault();
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const tags = document.getElementById('tags').value.split(',').map(t=>t.trim()).filter(t=>t);
  const filesInput = document.getElementById('files');

  if(title && description) {
    const fileUrls = filesInput.files.length > 0 ? await uploadFiles(filesInput.files) : [];
    const { error } = await supabase.from('entries').insert([{ title, description, tags, files: fileUrls, date: Date.now() }]);
    if(error) console.error(error);
    document.getElementById('entryForm').reset();
  }
});

// Search & sort
document.getElementById('search').addEventListener('input', e => displayEntries(e.target.value.toLowerCase(), document.getElementById('sort').value));
document.getElementById('sort').addEventListener('change', e => displayEntries(document.getElementById('search').value.toLowerCase(), e.target.value));
function filterByTag(tag){ document.getElementById('search').value = tag; displayEntries(tag.toLowerCase(), document.getElementById('sort').value); }

// PDF modal
const modal = document.getElementById('pdfModal');
const frame = document.getElementById('pdfFrame');
document.getElementById('closeModal').onclick = ()=> modal.style.display = 'none';
function openPDF(url){ frame.src = url; modal.style.display = 'block'; }

// --- REALTIME UPDATES ---
supabase.channel('entries-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, payload => {
    console.log('Realtime update:', payload);
    displayEntries(document.getElementById('search').value.toLowerCase(), document.getElementById('sort').value);
  })
  .subscribe();

// Initial display
displayEntries();