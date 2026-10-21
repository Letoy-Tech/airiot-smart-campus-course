(() => {
  const dialog = document.querySelector('#saver');
  const answer = document.querySelector('#answer');
  const filename = document.querySelector('#filename');
  const status = document.querySelector('#save-status');
  answer.addEventListener('input', () => { status.textContent = answer.value.trim() ? '文字已放入。确认文件名后，点击“下载这个 .md 文件”。' : '还没有文字，请先粘贴 AI 回答。'; });
  const toast = document.querySelector('#copy-status');
  let toastTimer;
  const notify = message => { toast.textContent = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.textContent = '', 4200); };
  async function copy(text, button) {
    if (!text.trim()) { notify('还没有文字，请先粘贴或打开文件。'); return; }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else throw new Error('fallback');
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed'; area.style.opacity = '0';
      (dialog.open ? dialog : document.body).append(area);
      area.select();
      const ok = document.execCommand('copy'); area.remove();
      if (!ok) { notify('自动复制不可用，请选中文字后按 Ctrl+C 或 Command+C。'); return; }
    }
    const label = button.textContent;
    button.textContent = '已复制';
    setTimeout(() => button.textContent = label, 1800);
    const destinations = { prompt: '已复制提示词，粘贴到 AI 对话。', command: '已复制命令，在正文指定目录的终端执行。', code: '已复制代码，按本步说明保存到目标文件。', path: '已复制路径，在编辑器中打开。', sample: '已复制示例，按正文对照。' };
    notify(destinations[button.dataset.kind] || '已复制当前文字。');
  }
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => copy(document.getElementById(b.dataset.copy).textContent, b)));
  document.querySelector('#open-saver').addEventListener('click', () => dialog.showModal());
  document.querySelector('#close-saver').addEventListener('click', () => dialog.close());
  document.querySelector('#copy-answer').addEventListener('click', e => copy(answer.value,e.currentTarget));
  document.querySelector('#download-md').addEventListener('click', () => {
    if (!answer.value.trim()) { status.textContent = '还没有回答。先把 AI 回答粘贴到上面的文字框。'; answer.focus(); return; }
    const url = URL.createObjectURL(new Blob([answer.value.replace(/^\uFEFF/,'')],{type:'text/markdown;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = filename.value;
    document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),30000);
    status.textContent = `已发起下载：${filename.value}。请到浏览器下载记录查看，并把文件移到桌面 campus-ai-lab/docs；然后用“打开已有 .md 文件”重新检查。`;
  });
  const importer = document.querySelector('#import-md');
  importer.addEventListener('change', async () => {
    const file = importer.files[0];
    if (!file) return;
    if (file.size > 2*1024*1024) { status.textContent = '文件超过 2 MB，请选择本教程生成的小型 .md 文字文件。'; importer.value=''; return; }
    if (!/\.(md|txt)$/i.test(file.name)) { status.textContent = '请选择 .md 或 .txt 文件。'; importer.value=''; return; }
    try {
      answer.value = (await file.text()).replace(/^\uFEFF/,'');
      if ([...filename.options].some(o=>o.value===file.name)) filename.value=file.name;
      status.textContent = `已打开 ${file.name}。检查上面的中文与正文，再复制全文或修改后重新下载。`;
    } catch { status.textContent = '读取失败，请重新选择文件。'; }
    importer.value='';
  });
})();
