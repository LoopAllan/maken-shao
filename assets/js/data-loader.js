(() => {
  const datasets = ['world','systems','characters','walkthrough','maps','knowledge','endings','bosses'];
  async function loadJson(basePath, filename) { const response = await fetch(`${basePath}/data/${filename}`); if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`); return response.json(); }
  async function loadAllContent(basePath) { const entries = await Promise.all(datasets.map(async (name) => [name, await loadJson(basePath, `${name}.json`)])); return Object.fromEntries(entries); }
  window.MakenData = { datasets, loadJson, loadAllContent };
})();
