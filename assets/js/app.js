(() => {
  const basePath = document.documentElement.dataset.base || '.';
  const menuButton = document.querySelector('[data-menu-toggle]'); const sidebar=document.querySelector('.sidebar');
  menuButton?.addEventListener('click',()=>{const open=sidebar.classList.toggle('is-open');menuButton.setAttribute('aria-expanded',String(open));});
  const themeButton=document.querySelector('[data-theme-toggle]');
  function setTheme(theme){document.documentElement.dataset.theme=theme;themeButton?.setAttribute('aria-label',theme==='dark'?'切換為淺色模式':'切換為深色模式');}
  setTheme(localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
  themeButton?.addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('theme',theme);setTheme(theme);});
  document.querySelectorAll('[data-spoiler-toggle]').forEach((button)=>button.addEventListener('click',()=>{const target=document.getElementById(button.dataset.spoilerToggle);const hidden=target.hidden;target.hidden=!hidden;button.setAttribute('aria-expanded',String(hidden));button.textContent=hidden?'收合劇透內容':'展開劇透內容';}));
  const searchInput=document.querySelector('[data-search-input]'); const results=document.querySelector('[data-search-results]');
  function renderResult(type,item){const article=document.createElement('article');article.className='card';const h=document.createElement('h3');h.textContent=`[${type}｜${item.gameVersion}] ${item.title}`;const p=document.createElement('p');p.textContent=item.summary;article.append(h,p);return article;}
  async function search(){if(!searchInput||!results)return; const q=searchInput.value.trim().toLocaleLowerCase('zh-Hant'); results.replaceChildren();if(!q){results.textContent='請輸入關鍵字。';return;}try{const data=await window.MakenData.loadAllContent(basePath);const hits=Object.entries(data).flatMap(([type,items])=>items.filter((item)=>`${item.title} ${item.summary} ${item.content}`.toLocaleLowerCase('zh-Hant').includes(q)).map((item)=>[type,item]));results.textContent=`找到 ${hits.length} 筆結果。`;hits.forEach(([type,item])=>results.append(renderResult(type,item)));}catch(error){results.textContent='資料無法載入。直接以 file:// 開啟時，請改用本機靜態伺服器。';console.warn(error);}}
  document.querySelector('[data-search-submit]')?.addEventListener('click',search);searchInput?.addEventListener('keydown',(event)=>{if(event.key==='Enter')search();});
  const topButton=document.querySelector('[data-back-to-top]');topButton?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
})();
