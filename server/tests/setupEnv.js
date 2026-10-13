// Must be imported before the app, because the app checks these at startup
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123456";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.MONGO_URI = "unused-in-tests";