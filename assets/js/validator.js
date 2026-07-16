(() => {
  const enums = { gameVersion:['maken-x-dreamcast','maken-shao-ps2','both-confirmed'], confidence:['official','cross-verified','single-source','unverified'], verificationStatus:['verified','partially-verified','conflicting','not-verified'] };
  const required = ['id','title','summary','content','gameVersion','region','sourceIds','confidence','verificationStatus','verificationNote','lastVerified'];
  function validateRecord(record, sourceIds) { const errors=[]; required.forEach((key)=>{if (!(key in record) || record[key] === null) errors.push(`缺少必要欄位：${key}`);}); Object.entries(enums).forEach(([key,values])=>{if (record[key] && !values.includes(record[key])) errors.push(`${key} enum 無效`);}); if (!/^\d{4}-\d{2}-\d{2}$/.test(record.lastVerified || '')) errors.push('lastVerified 日期格式無效'); (record.sourceIds || []).forEach((id)=>{if(!sourceIds.has(id)) errors.push(`不存在的 sourceId：${id}`);}); return errors; }
  window.MakenValidator = { validateRecord };
})();
