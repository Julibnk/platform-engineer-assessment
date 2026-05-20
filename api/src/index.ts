import 'dotenv/config';
import app from './server.js';

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
