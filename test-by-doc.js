const http = require('http');
http.get('http://localhost:3000/api/clients/items/by-doc/39420407000103', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log('Status:', res.statusCode, 'Data:', data.substring(0, 100)));
});