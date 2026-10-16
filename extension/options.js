const u = document.getElementById('u'), k = document.getElementById('k'), s = document.getElementById('s'), m = document.getElementById('m');
chrome.storage.sync.get(['webhookUrl', 'senderKey'], d => { u.value = d.webhookUrl || ''; k.value = d.senderKey || ''; });
s.onclick = () => chrome.storage.sync.set({webhookUrl: u.value.trim(), senderKey: k.value.trim()}, () => { m.textContent = 'Saved'; setTimeout(() => m.textContent = '', 2000); });
