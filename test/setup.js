process.env.NODE_ENV ||= "test";
process.env.JWT_SECRET ||= "test-jwt-secret-with-at-least-32-characters";
process.env.API_KEY_PEPPER ||= "test-api-pepper-with-at-least-32-characters";
process.env.CORS_ALLOWED_ORIGINS ||= "http://localhost:5173";
process.env.SOCKET_ALLOWED_ORIGINS ||= "http://localhost:5173";
