# Bunsekikun

Bunsekikun is a web application for Japanese text analysis and learning, built with Next.js and React. It helps users break down Japanese sentences, look up words, and understand grammar, making it easier to read and learn authentic Japanese content.

## Features

- **Japanese Text Analysis:** Paste or type Japanese text to get word-by-word breakdowns, readings (furigana), and English meanings.
- **Word Lookup:** Click on any word to see dictionary definitions, JLPT level, and example sentences.
- **Grammar Hints:** Highlights common grammar points and particles.
- **Dark/Light Mode:** Switch between dark and light themes for comfortable reading.
- **Responsive Design:** Works on desktop and mobile browsers.

## Getting Started

1. **Clone the repository:**
   ```sh
   git clone https://github.com/luqhardy/bunsekikun.git
   cd bunsekikun
   ```
2. **Install dependencies:**
   ```sh
   npm install
   # or
   yarn install
   ```
3. **Run the development server:**
   ```sh
   npm run dev
   # or
   yarn dev
   ```
4. **Open in your browser:**
   Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
Bunsekikun/
  ├── src/
  │   ├── app/           # Next.js app directory
  │   ├── components/    # React components
  │   ├── lib/           # Utility functions, analyzers
  │   └── ...
  ├── public/            # Static assets
  ├── package.json
  ├── next.config.js/ts
  └── ...
```

## Credits

- Built by Luqman Hardy
- Uses [Kuromoji.js](https://github.com/takuyaa/kuromoji.js/) for Japanese morphological analysis
- Inspired by Yomichan, ichi.moe, and other Japanese learning tools

## License

MIT
