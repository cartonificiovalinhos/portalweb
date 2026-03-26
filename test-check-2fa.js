const http = require('http');

const req = http.request('http://localhost:3000/api/auth/check-2fa', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});

req.write(JSON.stringify({ email: 'portalweb@example.com', password: 'password' }));
req.end();
