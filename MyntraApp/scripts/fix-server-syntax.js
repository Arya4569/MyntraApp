const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.resolve(__dirname, '../../server');

// Clean up server.js first
let serverJs = fs.readFileSync(path.join(SERVER_DIR, 'src/server.js'), 'utf8');
serverJs = serverJs.replace(
  "const recommendationRoutes = require('./routes/recommendationRoutes');\\nconst realtimeRoutes = require('./routes/realtimeRoutes');",
  "const recommendationRoutes = require('./routes/recommendationRoutes');\nconst realtimeRoutes = require('./routes/realtimeRoutes');"
);
serverJs = serverJs.replace(
  "app.use('/api/recommendations', recommendationRoutes);\\napp.use('/api/realtime', realtimeRoutes);",
  "app.use('/api/recommendations', recommendationRoutes);\napp.use('/api/realtime', realtimeRoutes);"
);
fs.writeFileSync(path.join(SERVER_DIR, 'src/server.js'), serverJs, 'utf8');
console.log('Fixed server.js newlines');
