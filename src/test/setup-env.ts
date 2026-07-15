process.env.NODE_ENV ??= "test";
process.env.PORT ??= "5000";
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/crowdspark_test";
process.env.MONGODB_DB_NAME ??= "crowdspark_test";
process.env.CLIENT_URL ??= "http://127.0.0.1:5173";
process.env.BETTER_AUTH_URL ??= "http://127.0.0.1:5000";
process.env.BETTER_AUTH_SECRET ??= "test_secret_that_is_longer_than_thirty_two_characters";
process.env.WITHDRAWAL_ENCRYPTION_KEY ??=
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.DEMO_PAYMENTS ??= "true";
