const { config } = require('dotenv');
config();
const key = process.env.OPENROUTER_API_KEY;

async function run() {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  const free = data.data.filter(m => m.pricing.prompt === "0" || m.pricing.prompt === 0);
  console.log(free.map(m => m.id).slice(0, 20));
}
run();
