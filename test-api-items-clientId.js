const http = require('http');

http.get('http://localhost:3000/api/items?clientId=345', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const json = JSON.parse(data);
      console.log('Items length:', json.length);
      if (json.length > 0) {
        console.log('First item:', json[0].name);
      }
    } catch (e) {
      console.log('Response:', data);
    }
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});