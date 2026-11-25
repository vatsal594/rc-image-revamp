(function () {
  const SLOTS = window.SLOTS || [];
  const KEY = 'rc-image-approval-v1';
  let st = { picks: {}, notes: {}, none: {}, more: {}, keep: {}, reviewer: '' };
  try { st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  st.more = st.more || {};
  st.keep = st.keep || {};
  Object.keys(st.picks).forEach((k) => { if (!Array.isArray(st.picks[k])) st.picks[k] = [st.picks[k]]; });
  const picksOf = (code) => st.picks[code] || [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const pages = [...new Set(SLOTS.map((s) => s.page))];
  let filter = 'All';

  const shape = (s) => (/2368|2560|2264/.test(s.title) ? 'wide' : /844x1024/.test(s.title) ? 'tall' : '');
  const chipCls = (x) => (x === 'Matte' ? 'matte' : x === 'With people' ? 'people' : '');
  const decided = (s) => picksOf(s.code).length > 0 || !!st.none[s.code] || !!st.more[s.code] || !!st.keep[s.code];

  function renderTabs() {
    const t = $('#tabs');
    t.innerHTML = '';
    ['All', ...pages].forEach((p) => {
      const list = p === 'All' ? SLOTS : SLOTS.filter((s) => s.page === p);
      const b = document.createElement('button');
      b.className = 'tab' + (filter === p ? ' on' : '');
      b.innerHTML = `${esc(p)}<span class="n">${list.filter(decided).length}/${list.length}</span>`;
      b.onclick = () => { filter = p; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
      t.appendChild(b);
    });
  }

  function render() {
    renderTabs();
    const main = $('#slots');
    main.innerHTML = '';
    let lastPage = '';
    SLOTS.filter((s) => filter === 'All' || s.page === filter).forEach((s) => {
      if (s.page !== lastPage) {
        const h = document.createElement('h2');
        h.className = 'page-h';
        h.textContent = s.page;
        main.appendChild(h);
        lastPage = s.page;
      }
      const pick = picksOf(s.code);
      const parts = [];
      if (st.keep[s.code]) parts.push('<span class="status keep">Keep current</span>');
      if (st.none[s.code]) parts.push('<span class="status no">None of the new ones is good</span>');
      else if (pick.length) parts.push(`<span class="status ok">Approved: ${pick.length > 1 ? 'options' : 'option'} ${esc(pick.join(', '))}</span>`);
      if (st.more[s.code]) parts.push('<span class="status more">Generate more</span>');
      const status = parts.length ? parts.join(' ') : '<span class="status">Not decided</span>';
      const el = document.createElement('article');
      el.className = 'slot ' + shape(s);
      el.innerHTML = `<div class="slot-h"><h3><span class="code">${esc(s.code)}</span>${esc(s.title)}</h3>${status}</div>
        <div class="grid"></div>
        <div class="slot-f"><button class="keepbtn ${st.keep[s.code] ? 'on' : ''}">Keep current image</button>
        <button class="none ${st.none[s.code] ? 'on' : ''}">None of the new ones is good</button>
        <button class="morebtn ${st.more[s.code] ? 'on' : ''}">Generate more</button>
        <textarea placeholder="Comment (optional)">${esc(st.notes[s.code] || '')}</textarea></div>`;
      const grid = el.querySelector('.grid');
      const gallery = [{ src: s.before, cap: `${s.code}: current live image` }].concat(
        s.opts.map((o) => ({ src: o.src, cap: `${s.code} option ${o.opt} (${o.style})` })));

      const before = document.createElement('div');
      before.className = 'tile before' + (st.keep[s.code] ? ' sel' : '');
      before.innerHTML = `<span class="tick">&#10003;</span><button class="zoom">Zoom</button><img loading="lazy" src="${esc(s.before)}" alt="Current image for ${esc(s.code)}">
        <div class="meta"><span class="opt">Current</span><span class="chip matte">${st.keep[s.code] ? 'keep this' : 'live today'}</span></div>`;
      const toggleKeep = () => { if (st.keep[s.code]) delete st.keep[s.code]; else st.keep[s.code] = true; save(); render(); };
      before.onclick = (e) => { if (e.target.classList.contains('zoom')) { openLB(gallery, 0); return; } toggleKeep(); };
      grid.appendChild(before);

      s.opts.forEach((o, i) => {
        const t = document.createElement('div');
        t.className = 'tile' + (pick.includes(o.opt) ? ' sel' : '');
        t.innerHTML = `<span class="tick">&#10003;</span><button class="zoom">Zoom</button>
          <img loading="lazy" src="${esc(o.src)}" alt="${esc(s.code)} option ${esc(o.opt)}">
          <div class="meta"><span class="opt">Option ${esc(o.opt)}</span><span class="chip ${chipCls(o.style)}">${esc(o.style)}</span></div>`;
        t.onclick = (e) => {
          if (e.target.classList.contains('zoom')) { openLB(gallery, i + 1); return; }
          const next = pick.includes(o.opt) ? pick.filter((x) => x !== o.opt) : pick.concat(o.opt);
          if (next.length) st.picks[s.code] = next; else delete st.picks[s.code];
          delete st.none[s.code];
          save(); render();
        };
        grid.appendChild(t);
      });

      el.querySelector('.keepbtn').onclick = toggleKeep;
      el.querySelector('.none').onclick = () => {
        if (st.none[s.code]) delete st.none[s.code]; else { st.none[s.code] = true; delete st.picks[s.code]; }
        save(); render();
      };
      el.querySelector('.morebtn').onclick = () => {
        if (st.more[s.code]) delete st.more[s.code]; else st.more[s.code] = true;
        save(); render();
      };
      el.querySelector('textarea').oninput = (e) => { st.notes[s.code] = e.target.value; save(); renderSummary(); };
      main.appendChild(el);
    });
    const done = SLOTS.filter(decided).length;
    $('#prog').textContent = `${done} / ${SLOTS.length}`;
    $('#barfill').style.width = (SLOTS.length ? (100 * done) / SLOTS.length : 0) + '%';
    renderSummary();
    if (typeof updateWarn === 'function') updateWarn();
  }

  function rows() {
    return SLOTS.map((s) => {
      const p = picksOf(s.code);
      const os = s.opts.filter((x) => p.includes(x.opt));
      return { code: s.code, page: s.page, slot: s.title, approved: [st.keep[s.code] ? 'KEEP CURRENT' : '', st.none[s.code] ? 'NONE OF NEW' : p.join(' + ')].filter(Boolean).join(' + '),
        more: st.more[s.code] ? 'YES' : '',
        style: os.map((o) => o.style).join(' + '), file: os.map((o) => o.src).join(' | '), comment: st.notes[s.code] || '' };
    });
  }

  function renderSummary() {
    $('#summary').innerHTML = `<h2 class="page-h">Summary</h2><table><thead><tr><th>Code</th><th>Page</th><th>Approved</th><th>Style</th><th>Generate more</th><th>Comment</th></tr></thead><tbody>${rows()
      .map((x) => `<tr><td>${esc(x.code)}</td><td>${esc(x.page)}</td><td>${x.approved ? esc(x.approved) : '<span class="muted">-</span>'}</td><td>${esc(x.style)}</td><td>${esc(x.more)}</td><td>${esc(x.comment)}</td></tr>`)
      .join('')}</tbody></table>`;
  }

  function toast(m) {
    const t = $('#toast');
    t.textContent = m;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1800);
  }

  $('#reviewer').value = st.reviewer || '';
  $('#reviewer').oninput = (e) => { st.reviewer = e.target.value; save(); };
  $('#btnReset').onclick = () => {
    if (confirm('Clear all approvals and comments?')) { st = { picks: {}, notes: {}, none: {}, more: {}, keep: {}, reviewer: st.reviewer }; save(); render(); }
  };
  $('#btnCopy').onclick = () => {
    const txt = `Image approvals${st.reviewer ? ' by ' + st.reviewer : ''}\n` +
      rows().map((x) => `${x.code}: ${x.approved || 'not decided'}${x.more ? ' [generate more]' : ''}${x.comment ? ' - ' + x.comment : ''}`).join('\n');
    const ok = () => toast('Summary copied');
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok, () => prompt('Copy this:', txt));
    else prompt('Copy this:', txt);
  };
  $('#btnExport').onclick = () => {
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const csv = ['code,page,slot,approved,style,generate_more,file,comment,reviewer']
      .concat(rows().map((x) => [x.code, x.page, x.slot, x.approved, x.style, x.more, x.file, x.comment, st.reviewer].map(q).join(',')))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'image-approvals.csv';
    a.click();
  };

  const TO = 'vatsal.savani@newfold.com';
  function submitText() {
    const lines = [];
    let page = '';
    rows().forEach((x) => {
      if (x.page !== page) { lines.push('', `== ${x.page} ==`); page = x.page; }
      const bits = [x.approved || 'not decided'];
      if (x.more) bits.push('GENERATE MORE');
      if (x.comment) bits.push('Comment: ' + x.comment.replace(/\s+/g, ' '));
      lines.push(`${x.code}: ${bits.join(' | ')}`);
    });
    return `Image revamp approvals from ${st.reviewer || '(no name)'}\n` + lines.join('\n').trim() + '\n\nPage: ' + location.href.split('#')[0];
  }
  function updateWarn() {
    const left = SLOTS.filter((s) => !decided(s)).length;
    $('#submitWarn').textContent = left ? `${left} slot${left > 1 ? 's' : ''} not decided yet (you can still send).` : '';
  }
  function askName() {
    if (st.reviewer) return true;
    const n = prompt('Your name (so Vatsal knows who sent this):', '');
    if (n === null) return false;
    st.reviewer = n.trim(); $('#reviewer').value = st.reviewer; save();
    return true;
  }
  const subjectLine = () => `Image revamp approvals - ${st.reviewer || 'reviewer'}`;
  $('#btnTxt').onclick = () => {
    if (!askName()) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([submitText().replace(/\n/g, '\r\n')], { type: 'text/plain' }));
    a.download = `image-approvals-${(st.reviewer || 'reviewer').replace(/[^\w-]+/g, '-')}.txt`;
    a.click();
    toast('Downloaded - share this file with Vatsal');
  };
  $('#btnOwa').onclick = () => {
    if (!askName()) return;
    const full = submitText();
    let body = full;
    if (full.length > 1500) {
      body = 'My full list is on the clipboard - please paste it below (Ctrl+V).\n\n';
      if (navigator.clipboard) navigator.clipboard.writeText(full).then(() => toast('List copied - paste it into the email'), () => prompt('Copy this into the email:', full));
    }
    window.open(`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(TO)}&subject=${encodeURIComponent(subjectLine())}&body=${encodeURIComponent(body)}`, '_blank');
  };
  $('#btnSubmit').onclick = () => {
    if (!askName()) return;
    const subject = subjectLine();
    let body = submitText();
    const full = body;
    let url = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (url.length > 1900) {
      body = 'My full list is on the clipboard - please paste it below (Ctrl+V).\n\n';
      url = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      if (navigator.clipboard) navigator.clipboard.writeText(full).then(() => toast('List copied - paste it into the email'), () => prompt('Copy this into the email:', full));
      else prompt('Copy this into the email:', full);
    }
    window.location.href = url;
  };

  let lb = [], li = 0;
  function openLB(list, i) { lb = list; li = i; showLB(); $('#lb').hidden = false; }
  function showLB() { $('#lbImg').src = lb[li].src; $('#lbCap').textContent = `${lb[li].cap}  (${li + 1}/${lb.length})`; }
  $('#lbClose').onclick = () => { $('#lb').hidden = true; };
  $('#lb').onclick = (e) => { if (e.target.id === 'lb') $('#lb').hidden = true; };
  $('#lbPrev').onclick = () => { li = (li - 1 + lb.length) % lb.length; showLB(); };
  $('#lbNext').onclick = () => { li = (li + 1) % lb.length; showLB(); };
  document.addEventListener('keydown', (e) => {
    if ($('#lb').hidden) return;
    if (e.key === 'Escape') $('#lb').hidden = true;
    if (e.key === 'ArrowLeft') $('#lbPrev').click();
    if (e.key === 'ArrowRight') $('#lbNext').click();
  });

  render();
})();
