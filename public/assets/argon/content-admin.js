(() => {
  const form = document.getElementById('content-editor');
  if (!form) return;
  const body = document.getElementById('entry-body');
  const visualPanel = document.getElementById('visual-editor');
  const sourceToolbar = document.getElementById('source-toolbar');
  const visualTab = document.getElementById('tab-visual');
  const sourceTab = document.getElementById('tab-source');
  const message = document.getElementById('editor-message');
  const saveState = document.getElementById('save-state');
  const format = form.elements.namedItem('format');
  let visual = form.dataset.originalFormat !== 'markdown';
  let editor;
  let visualBaseline = '';
  let visualSource = body.value;
  let dirty = false;
  let generation = 0;
  let saving = false;
  let switching = false;
  let mediaTarget = 'body';
  let mediaItems = [];
  let selectedMedia;
  let blockMediaCallback;

  function notify(text, error = false) {
    message.textContent = text;
    message.classList.toggle('error', error);
    message.hidden = false;
  }

  function countWords() {
    const text = visual && editor ? editor.getContent({ format: 'text' }) : body.value.replace(/<[^>]*>/g, ' ');
    document.getElementById('word-count').textContent = '字数 ' + [...text.replace(/\s/g, '')].length.toLocaleString('zh-CN');
  }

  function changed() {
    dirty = true;
    generation++;
    saveState.textContent = '有未保存的修改';
    countWords();
  }

  function syncSource() {
    if (visual && editor && editor.getContent() !== visualBaseline) {
      body.value = editor.getContent();
      format.value = 'html';
      visualBaseline = body.value;
      visualSource = body.value;
    }
    if (visual && !editor) {
      body.value = document.getElementById('rich-body').value;
      format.value = 'html';
    }
  }

  function showMode() {
    visualPanel.hidden = !visual;
    body.hidden = visual;
    sourceToolbar.hidden = visual;
    visualTab.setAttribute('aria-selected', String(visual));
    sourceTab.setAttribute('aria-selected', String(!visual));
    document.getElementById('source-format-label').textContent = format.value === 'markdown' ? 'Markdown' : 'HTML';
    countWords();
  }

  async function switchMode(toVisual) {
    if (switching || visual === toVisual) return;
    switching = true;
    try {
      if (!toVisual) syncSource();
      else if (body.value !== visualSource) {
        let html = body.value;
        if (format.value === 'markdown') {
          const response = await fetch('/auth/content/render/', { method: 'POST', body: new URLSearchParams({ body: body.value }) });
          if (!response.ok) throw new Error('转换失败，请确认登录状态后重试。');
          html = (await response.json()).html;
        }
        if (editor) {
          editor.setContent(html);
          visualBaseline = editor.getContent();
        } else document.getElementById('rich-body').value = html;
        visualSource = body.value;
      }
      visual = toVisual;
      showMode();
      if (visual) editor?.focus();
      else body.focus();
    } catch (error) { notify(error.message, true); }
    finally { switching = false; }
  }

  async function uploadFile(file) {
    if (file.size > 20 * 1024 * 1024) throw new Error('单个文件不能超过 20 MB。');
    const data = new FormData();
    data.append('file', file);
    const response = await fetch('/auth/content/media/', { method: 'POST', body: data });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || '上传失败，请确认登录状态后重试。');
    }
    return response.json();
  }

  if (form.dataset.editor === 'blocks' && window.ArgonBlockEditor) {
    try {
      editor = ArgonBlockEditor.mount(document.getElementById('block-editor'), document.getElementById('rich-body').value, {
        onChange: changed,
        uploadFile,
        onMedia: (callback) => { blockMediaCallback = callback; void openMedia('block'); },
      });
      visualBaseline = editor.getContent();
    } catch (error) {
      visual = false;
      notify('区块编辑器加载失败，请刷新后重试。正文保留在文本模式中。', true);
      console.error(error);
    }
  } else if (window.tinymce) {
    tinymce.init({
      selector: '#rich-body', language: 'zh_CN', language_url: '/assets/argon/tinymce-zh.js',
      theme: 'modern', skin: 'lightgray', menubar: false, branding: false,
      plugins: 'lists link image media paste textcolor colorpicker fullscreen hr charmap',
      toolbar1: 'formatselect | bold italic strikethrough | bullist numlist blockquote | alignleft aligncenter alignright | link unlink | image media | fullscreen',
      toolbar2: 'undo redo | underline forecolor backcolor | outdent indent | hr charmap removeformat | codeblock argon',
      block_formats: '段落=p;标题 2=h2;标题 3=h3;标题 4=h4;预格式化文本=pre',
      height: 460, resize: true, relative_urls: false, remove_script_host: false,
      convert_urls: false, entity_encoding: 'raw', image_caption: true,
      paste_data_images: true, automatic_uploads: true,
      content_style: 'body{font:16px/1.8 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#1d2327;margin:20px;overflow-wrap:anywhere}img,video{max-width:100%;height:auto}blockquote{border-left:4px solid #c3c4c7;margin-left:0;padding-left:18px;color:#50575e}pre{background:#f6f7f7;padding:14px;white-space:pre-wrap}a{color:#2271b1}table{border-collapse:collapse}td,th{border:1px solid #c3c4c7;padding:6px}',
      images_upload_handler(blob, success, failure) {
        uploadFile(new File([blob.blob()], blob.filename(), { type: blob.blob().type }))
          .then((media) => success(media.url)).catch((error) => failure(error.message));
      },
      setup(instance) {
        editor = instance;
        instance.addShortcut('meta+s', '保存草稿', () => { void save('draft'); });
        instance.addButton('codeblock', { icon: 'code', tooltip: '代码块', onclick() {
          const selected = instance.selection.getContent({ format: 'text' });
          const node = document.createElement('pre');
          node.className = 'code';
          node.textContent = selected || '在此输入代码';
          instance.insertContent(node.outerHTML + '<p></p>');
        } });
        instance.addButton('argon', { type: 'menubutton', text: 'Argon', icon: false, menu: [
          { text: '标签', onclick: () => instance.insertContent('<span class="badge badge-primary">标签文字</span> ') },
          { text: '提示', onclick: () => instance.insertContent('<div class="alert alert-info"><p>提示内容</p></div><p></p>') },
          { text: '警告', onclick: () => instance.insertContent('<div class="alert alert-warning"><p>警告内容</p></div><p></p>') },
          { text: '折叠内容', onclick: () => instance.insertContent('<details><summary>点击展开</summary><p>折叠内容</p></details><p></p>') },
          { text: '进度条', onclick: () => instance.insertContent('<div class="progress"><div class="progress-bar" style="width:50%">50%</div></div><p></p>') },
        ] });
        instance.on('init', () => {
          visualBaseline = instance.getContent();
          showMode();
        });
        instance.on('input change undo redo', () => {
          if (!switching && instance.getContent() !== visualBaseline) changed();
        });
      },
    }).catch(() => {
      visual = false;
      showMode();
      notify('可视化编辑器加载失败，正文仍可在文本模式编辑。', true);
    });
  } else {
    visual = false;
    notify('可视化编辑器未加载，请刷新页面。', true);
  }

  visualTab.addEventListener('click', () => { void switchMode(true); });
  sourceTab.addEventListener('click', () => { void switchMode(false); });
  form.addEventListener('input', changed);
  form.addEventListener('change', changed);
  document.getElementById('entry-visibility').addEventListener('change', (event) => {
    document.getElementById('password-setting').hidden = event.target.value !== 'password';
  });
  document.getElementById('rich-body').addEventListener('input', changed);

  const dateInput = document.getElementById('publication-date');
  const published = form.elements.namedItem('published');
  const date = new Date(published.value || Date.now());
  dateInput.value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  dateInput.addEventListener('change', () => {
    if (dateInput.value) published.value = new Date(dateInput.value).toISOString();
  });

  function fields(intent) {
    syncSource();
    const data = new URLSearchParams();
    for (const [key, value] of new FormData(form)) if (typeof value === 'string') data.append(key, value);
    data.set('intent', intent);
    return data;
  }

  async function save(intent) {
    if (saving || switching) return;
    saving = true;
    const buttons = [...form.querySelectorAll('button[name=intent]')];
    buttons.forEach((button) => { button.disabled = true; });
    try {
      if (editor && visual) await editor.uploadImages();
      const data = fields(intent);
      const savedGeneration = generation;
      saveState.textContent = '正在保存…';
      const response = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.id) throw new Error(result.error || '保存失败，请确认登录状态后重试。当前内容仍保留在编辑器中。');
      form.elements.namedItem('id').value = result.id;
      form.elements.namedItem('revision').value = result.revision;
      form.dataset.live = String(result.live);
      history.replaceState(null, '', result.location);
      dirty = generation !== savedGeneration;
      saveState.textContent = dirty ? '有未保存的修改' : '已保存 · ' + new Date().toLocaleTimeString('zh-CN');
      document.getElementById('publication-state').textContent = result.draft ? (result.live ? '有未发布修改' : '草稿') : '已发布';
      document.getElementById('publish-content').textContent = result.live ? '更新' : '发布';
      const permalink = document.querySelector('.permalink');
      if (!document.getElementById('entry-permalink')) {
        permalink.querySelector('label')?.remove();
        const link = document.createElement('a');
        link.id = 'entry-permalink';
        link.target = '_blank';
        link.rel = 'noopener';
        permalink.append(link);
      }
      const link = document.getElementById('entry-permalink');
      link.href = result.path;
      link.textContent = location.origin + result.path;
      notify(result.draft ? '草稿已保存。' : '内容已更新。');
    } catch (error) {
      notify(error.message, true);
      saveState.textContent = '保存失败，内容尚未保存';
    } finally {
      saving = false;
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void save(event.submitter?.value || 'publish');
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void save('draft');
    }
  });
  window.addEventListener('beforeunload', (event) => {
    if (dirty || saving) { event.preventDefault(); event.returnValue = ''; }
  });
  setInterval(() => {
    if (dirty && !saving && !switching && document.visibilityState === 'visible') void save('draft');
  }, 60_000);

  sourceToolbar.addEventListener('click', (event) => {
    const kind = event.target.closest('[data-wrap]')?.dataset.wrap;
    if (!kind) return;
    const selected = body.value.slice(body.selectionStart, body.selectionEnd) || '文字';
    const markdown = format.value === 'markdown';
    const wraps = markdown ? { strong: ['**','**'], em: ['*','*'], blockquote: ['> ',''], code: ['\n```\n','\n```\n'], link: ['[','](https://)'] }
      : { strong: ['<strong>','</strong>'], em: ['<em>','</em>'], blockquote: ['<blockquote>','</blockquote>'], code: ['<pre class="code">','</pre>'], link: ['<a href="https://">','</a>'] };
    body.setRangeText(wraps[kind][0] + selected + wraps[kind][1], body.selectionStart, body.selectionEnd, 'select');
    changed();
    body.focus();
  });

  document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  document.getElementById('preview-content').addEventListener('click', async () => {
    try {
      const response = await fetch('/auth/content/preview/', { method: 'POST', body: fields('draft') });
      if (!response.ok) throw new Error(await response.text() || '预览失败，请重试。');
      document.getElementById('preview-frame').srcdoc = await response.text();
      document.getElementById('preview-dialog').showModal();
    } catch (error) { notify(error.message, true); }
  });

  function renderMedia() {
    const grid = document.getElementById('media-grid');
    grid.replaceChildren();
    const search = document.getElementById('media-search').value.toLocaleLowerCase();
    for (const media of mediaItems.filter((item) => item.name.toLocaleLowerCase().includes(search) && (mediaTarget !== 'featured' || item.mime.startsWith('image/')))) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'media-item';
      button.setAttribute('aria-pressed', String(selectedMedia?.url === media.url));
      if (media.mime.startsWith('image/')) {
        const image = new Image();
        image.src = media.url;
        image.alt = '';
        image.loading = 'lazy';
        button.append(image);
      }
      const name = document.createElement('span');
      name.textContent = media.name;
      button.append(name);
      button.addEventListener('click', () => {
        selectedMedia = media;
        document.getElementById('media-url').value = media.url;
        document.getElementById('media-alt').value = media.name.replace(/\.[^.]+$/, '');
        renderMedia();
      });
      grid.append(button);
    }
  }

  async function openMedia(target) {
    mediaTarget = target;
    selectedMedia = undefined;
    if (editor?.selection?.getBookmark) openMedia.bookmark = editor.selection.getBookmark(2, true);
    document.getElementById('media-title').textContent = target === 'featured' ? '设置特色图片' : '添加媒体';
    document.getElementById('media-url').value = '';
    document.getElementById('media-alt').value = '';
    document.getElementById('media-dialog').showModal();
    const status = document.getElementById('media-message');
    status.textContent = '正在读取媒体库…';
    try {
      const response = await fetch('/auth/content/media/');
      if (!response.ok) throw new Error('媒体库读取失败，请确认登录状态。');
      mediaItems = await response.json();
      status.textContent = mediaItems.length ? '' : '可以上传文件或从网址插入。';
      renderMedia();
    } catch (error) { status.textContent = error.message; }
  }

  document.getElementById('add-media').addEventListener('click', () => { void openMedia('body'); });
  document.getElementById('choose-featured')?.addEventListener('click', () => { void openMedia('featured'); });
  document.getElementById('media-search').addEventListener('input', renderMedia);
  document.getElementById('media-url').addEventListener('input', () => { selectedMedia = undefined; });
  document.getElementById('media-upload').addEventListener('change', async (event) => {
    const status = document.getElementById('media-message');
    const input = event.target;
    input.disabled = true;
    try {
      for (const file of input.files) {
        status.textContent = '正在上传 ' + file.name + '…';
        const media = await uploadFile(file);
        mediaItems.unshift(media);
        selectedMedia = media;
        document.getElementById('media-url').value = media.url;
        document.getElementById('media-alt').value = media.name.replace(/\.[^.]+$/, '');
        renderMedia();
      }
      status.textContent = '上传完成，选中文件后点击插入。';
    } catch (error) { status.textContent = error.message; }
    finally { input.disabled = false; input.value = ''; }
  });

  document.getElementById('insert-media').addEventListener('click', () => {
    const url = document.getElementById('media-url').value.trim();
    const alt = document.getElementById('media-alt').value;
    if (!/^(?:\/(?!\/)|https?:\/\/)/i.test(url) || /[\x00-\x20\\]/.test(url)) {
      document.getElementById('media-message').textContent = '请选择媒体，或输入有效的图片、音频、视频网址。';
      return;
    }
    if (mediaTarget === 'block' && blockMediaCallback) {
      blockMediaCallback({ url, alt, name: alt, type: (selectedMedia?.mime ?? 'image/png').split('/')[0], mime: selectedMedia?.mime ?? 'image/png', sizes: { full: { url } } });
      changed();
    } else if (mediaTarget === 'featured') {
      document.getElementById('featured-image').value = url;
      const image = document.getElementById('featured-preview');
      image.src = url;
      image.hidden = false;
      document.getElementById('remove-featured').hidden = false;
      changed();
    } else {
      const mime = selectedMedia?.mime ?? (/\.(mp4)(?:[?#]|$)/i.test(url) ? 'video/mp4' : /\.(mp3|ogg)(?:[?#]|$)/i.test(url) ? 'audio/mpeg' : 'image/*');
      const node = document.createElement(mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : mime === 'application/pdf' ? 'a' : 'img');
      if (node.tagName === 'A') { node.href = url; node.textContent = alt || selectedMedia.name; }
      else { node.src = url; if (node.tagName === 'IMG') node.alt = alt; else node.controls = true; }
      if (visual && editor) {
        editor.focus();
        if (openMedia.bookmark && editor.selection) editor.selection.moveToBookmark(openMedia.bookmark);
        editor.insertContent(node.outerHTML);
      } else {
        const markup = format.value === 'markdown' && node.tagName === 'IMG' ? '![' + alt.replace(/[\[\]]/g, '') + '](' + url + ')' : node.outerHTML;
        body.setRangeText(markup, body.selectionStart, body.selectionEnd, 'end');
      }
      changed();
    }
    document.getElementById('media-dialog').close();
  });
  document.getElementById('remove-featured')?.addEventListener('click', () => {
    document.getElementById('featured-image').value = '';
    document.getElementById('featured-preview').hidden = true;
    document.getElementById('remove-featured').hidden = true;
    changed();
  });
  showMode();
})();
