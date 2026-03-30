import { defineConfig } from 'vite'
import { exec } from 'child_process'

const apiPlugin = () => ({
  name: 'update-data-api',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/api/update-data' && req.method === 'POST') {
        const cmd = 'python extract_data.py';
        exec(cmd, { encoding: 'utf8' }, (err, stdout, stderr) => {
          res.setHeader('Content-Type', 'application/json');
          if (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message, stderr }));
          } else {
            res.end(JSON.stringify({ success: true, stdout }));
          }
        });
        return;
      }
      next();
    });
  }
});

export default defineConfig({
  base: '/MyCalendar/',
  plugins: [apiPlugin()]
})
