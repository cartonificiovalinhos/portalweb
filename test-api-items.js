const http = require('http');

http.get('http://localhost:3000/api/items?customerDoc=39420407000103', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      console.log('Items:', JSON.parse(data).length);
      if (JSON.parse(data).length > 0) {
        console.log('First item:', JSON.parse(data)[0].name);
      }
    } catch (e) {
      console.log('Response:', data);
    }
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});