const { default: handler } = require('./pages/api/guided_discovery');

function mockReq(body) {
    return { method: 'POST', body };
}
function mockRes() {
    const res = {};
    res.statusCode = 200;
    res._status = null;
    res._json = null;
    res.status = (code) => { res._status = code; return res; };
    res.json = (obj) => { res._json = obj; console.log('Response status:', res._status); console.log('Response body:', JSON.stringify(obj, null, 2)); };
    return res;
}

(async () => {
    const req = mockReq({ userId: 'test', message: 'test' }); // placeholder, will be overwritten by flow
    const res = mockRes();
    // Simulate conversation steps
    await handler(req, res);
})();
