const https = require('https');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function getLinks() {
  try {
    const urls = new Set();
    const categories = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07'];
    for (const cat of categories) {
      const data = await fetchPage(`https://www.giftpop.vn/category/?c_code=${cat}`);
      const regex = /href="\/category\/view\/([A-Za-z0-9_]+)"/g;
      let match;
      while ((match = regex.exec(data)) !== null) {
        urls.add(`https://www.giftpop.vn/category/view/${match[1]}`);
      }
      if (urls.size >= 80) break;
    }
    console.log(Array.from(urls).slice(0, 80).join(','));
  } catch(e) {
    console.error(e);
  }
}
getLinks();
