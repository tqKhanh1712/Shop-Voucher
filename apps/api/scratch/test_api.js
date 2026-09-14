const http = require('http');

http.get('http://127.0.0.1:3001/vouchers?keyword=%C4%91%E1%BB%93+u%E1%BB%91ng&validityStatus=ALL&page=2', (res) => {
  let data = '';
  console.log('Status Code:', res.statusCode);
  
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:', data.substring(0, 500) + '...');
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
