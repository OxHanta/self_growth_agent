import OpenAI from 'openai';
import { config } from './src/config';

async function testGroq() {
  try {
    const groq = new OpenAI({ apiKey: config.llm.groqApiKey, baseURL: 'https://api.groq.com/openai/v1' });
    const res = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 10
    });
    console.log('Groq Success:', res.choices[0].message.content);
  } catch (e: any) {
    console.log('Groq Error:', e.message);
  }
}

async function testOpenRouter() {
  try {
    const openrouter = new OpenAI({ apiKey: config.llm.openrouterApiKey, baseURL: 'https://openrouter.ai/api/v1' });
    const res = await openrouter.chat.completions.create({
      model: 'google/gemma-2-9b-it:free',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 10
    });
    console.log('OpenRouter Success:', res.choices[0].message.content);
  } catch (e: any) {
    console.log('OpenRouter Error:', e.message);
  }
}

async function testGemini() {
  try {
    const gemini = new OpenAI({ apiKey: config.llm.geminiApiKey, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' });
    const res = await gemini.chat.completions.create({
      model: 'gemini-1.5-flash',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 10
    });
    console.log('Gemini Success:', res.choices[0].message.content);
  } catch (e: any) {
    console.log('Gemini Error:', e.message);
  }
}

async function main() {
  await testGroq();
  await testOpenRouter();
  await testGemini();
}
main();
