"use client";
import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';

// --- TypeScript Type Definitions ---

// For the raw token returned by kuromoji.js
interface KuromojiToken {
    surface_form: string;
    pos: string;
    pos_detail_1: string;
    pos_detail_2: string;
    pos_detail_3: string;
    conjugated_type: string;
    conjugated_form: string;
    basic_form: string;
    reading: string;
    pronunciation: string;
}

// For the tokenizer object itself
interface KuromojiTokenizer {
    tokenize: (text: string) => KuromojiToken[];
}

// To let TypeScript know about the kuromoji object on the window
declare global {
    interface Window {
        kuromoji: {
            builder: (options: { dicPath: string }) => {
                build: (callback: (err: Error | null, tokenizer: KuromojiTokenizer) => void) => void;
            };
        };
    }
}

// The internal representation of a token [surface, reading, pos]
type AnalyzedToken = [string, string, string];
// A "word" is a group of one or more tokens
type AnalyzedWord = AnalyzedToken[];

// The final analysis result structure
interface AnalysisResult {
    word_list: AnalyzedWord[];
}

// Types for the Jisho.org API response
interface JishoJapaneseWord {
    word?: string;
    reading?: string;
}
interface JishoSense {
    english_definitions: string[];
    parts_of_speech: string[];
    links: { text: string; url: string }[];
    tags: string[];
    restrictions: string[];
    see_also: string[];
    antonyms: string[];
    //source: unknown[];
    info: string[];
}
interface JishoData {
    slug: string;
    is_common: boolean;
    tags: string[];
    jlpt: string[];
    japanese: JishoJapaneseWord[];
    senses: JishoSense[];
    attribution: {
        jmdict: boolean;
        jmnedict: boolean;
        dbpedia: boolean | string;
    };
}


// --- Helper Data ---

const posColors: { [key: string]: string } = {
  "名詞": "bg-green-200 text-green-800",
  "助詞": "bg-yellow-200 text-yellow-800",
  "動詞": "bg-red-200 text-red-800",
  "助動詞": "bg-red-200 text-red-800",
  "形容詞": "bg-blue-200 text-blue-800",
  "副詞": "bg-purple-200 text-purple-800",
  "接続詞": "bg-indigo-200 text-indigo-800",
  "連体詞": "bg-pink-200 text-pink-800",
  "感動詞": "bg-teal-200 text-teal-800",
  "接頭詞": "bg-gray-200 text-gray-800",
  "接尾辞": "bg-gray-200 text-gray-800",
  "記号": "bg-gray-100 text-gray-600",
  "フィラー": "bg-gray-200 text-gray-700",
  "その他": "bg-gray-200 text-gray-700",
  "補助記号": "bg-gray-100 text-gray-600",
  "未知語": "bg-gray-300 text-gray-900",
};

// --- Kuromoji & Jisho API Functions ---

let kuromojiTokenizer: KuromojiTokenizer | null = null;

const loadKuromoji = (setTokenizerLoading: React.Dispatch<React.SetStateAction<boolean>>, setError?: React.Dispatch<React.SetStateAction<string | null>>): void => {
    setTokenizerLoading(true);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js";
    script.async = true;
    script.onload = () => {
        if (timeoutId) { clearTimeout(timeoutId); }
        if (!window.kuromoji) {
            setTokenizerLoading(false);
            if (setError) setError("Kuromoji script loaded but window.kuromoji is undefined.");
            return;
        }
        window.kuromoji.builder({ dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/" }).build((err, tokenizer) => {
            if (err) {
                console.error("Kuromoji build error:", err);
                setTokenizerLoading(false);
                if (setError) setError("Failed to build Kuromoji tokenizer.");
                return;
            }
            kuromojiTokenizer = tokenizer;
            console.log("Kuromoji tokenizer loaded.");
            setTokenizerLoading(false);
        });
    };
    script.onerror = () => {
        if (timeoutId) { clearTimeout(timeoutId); }
        console.error("Failed to load Kuromoji script.");
        setTokenizerLoading(false);
        if (setError) setError("Failed to load Kuromoji script from CDN.");
    };
    // Timeout after 10 seconds
    timeoutId = setTimeout(() => {
        console.error("Kuromoji script load timed out.");
        setTokenizerLoading(false);
        if (setError) setError("Kuromoji script load timed out. Please check your connection or try again later.");
    }, 10000);
    document.body.appendChild(script);
};

const groupTokens = (tokens: KuromojiToken[]): AnalyzedWord[] => {
    if (!tokens || tokens.length === 0) return [];
    
    const wordList: AnalyzedWord[] = [];
    let currentWord: AnalyzedWord = [];

    tokens.forEach(token => {
        const newToken: AnalyzedToken = [token.surface_form, token.reading || token.surface_form, token.pos];
        
        if (currentWord.length === 0) {
            currentWord.push(newToken);
        } else {
            const prevPos = currentWord[currentWord.length - 1][2];
            if ((token.pos === '助動詞' && prevPos === '動詞') || 
                (token.pos === '助詞' && (token.pos_detail_1 === '接続助詞' || token.pos_detail_1 === '終助詞')) ||
                (token.pos === '動詞' && prevPos === '動詞' && token.pos_detail_1 === '非自立') ||
                (token.pos === '名詞' && token.pos_detail_1 === '接尾')
            ) {
                 currentWord.push(newToken);
            } else {
                wordList.push(currentWord);
                currentWord = [newToken];
            }
        }
    });

    if (currentWord.length > 0) {
        wordList.push(currentWord);
    }

    return wordList;
}

const getWordMeaningWithJisho = async (word: string): Promise<JishoData | null> => {
    console.log(`Getting Jisho definition for: ${word}`);
    // Use the Next.js API route proxy
    const response = await fetch(`/api/jisho?keyword=${encodeURIComponent(word)}`);
    
    if (!response.ok) {
        throw new Error(`Jisho API call failed with status: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.data && result.data.length > 0) {
        return result.data[0];
    } else {
        return null;
    }
};

// --- React Components ---

const Header: React.FC = () => (
    <header className="text-center p-6 rounded-xl">
        <h1 className="text-4xl md:text-5xl font-bold text-blue-600 tracking-wider">
            {/*
            <span className="inline-block bg-gray-200 rounded-full px-4 py-2 mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 inline-block text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <Image src="/assets/icon.png" alt="Bunsekikun Icon" className="inline-block h-40 w-auto align-middle mr-2" />*/}
            <Image src="/assets/icon.png" alt="Bunsekikun Icon" width={160} height={160} className="inline-block h-40 w-auto align-middle mr-2" /> 
        </h1>
        <p className="text-gray-500 mt-2">Japanese Analyzer (Kuromoji & Jisho)</p>
    </header>
);

interface WordInfoProps {
    selectedWord: AnalyzedWord | null;
    onClose: () => void;
}

const WordInfo: React.FC<WordInfoProps> = ({ selectedWord, onClose }) => {
    const [jishoData, setJishoData] = useState<JishoData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!selectedWord) {
            setJishoData(null);
            return;
        }

        const fetchMeaning = async () => {
            setIsLoading(true);
            setError('');
            setJishoData(null);
            try {
                const baseForm = selectedWord[0][0]; 
                const result = await getWordMeaningWithJisho(baseForm);
                setJishoData(result);
            } catch (err) {
                console.error(err);
                setError("Failed to fetch definition from Jisho.org.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchMeaning();
    }, [selectedWord]);

    if (!selectedWord) {
        return (
            <div className="mt-6 p-6 bg-white rounded-xl shadow-lg border border-gray-200 text-center text-gray-500">
                <p>Select a word to see its details here.</p>
            </div>
        );
    }

    return (
        <div className="mt-6 p-6 bg-white rounded-xl shadow-lg border border-gray-200 relative animate-fade-in">
            <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">{selectedWord.map(token => token[0]).join('')}</h3>
            <div className="space-y-3 text-left">
                <p><strong className="font-semibold text-gray-600 w-24">Reading: {selectedWord.map(token => token[1]).join('')}</strong></p>
                <p><strong className="font-semibold text-gray-600 w-24">Part of Speech: {selectedWord.map(t => t[2]).join(', ')}</strong></p>
                <div className="pt-2">
                    <strong className="font-semibold text-gray-600 w-full inline-block">Meaning (from Jisho.org):</strong>
                    {isLoading && <p>Loading definition...</p>}
                    {error && <p className="text-red-500">{error}</p>}
                    {jishoData ? (
                        <div className="mt-2 space-y-3 pl-2 border-l-4 border-gray-200">
                            {jishoData.senses.map((sense, index) => (
                                <div key={index}>
                                    <p className="font-medium text-gray-700">{index + 1}. {sense.english_definitions.join('; ')}</p>
                                    <p className="text-sm text-gray-500 ml-4">{sense.parts_of_speech.join(', ')}</p>
                                </div>
                            ))}
                        </div>
                    ) : (!isLoading && <p>No definition found.</p>)}
                </div>
            </div>
        </div>
    );
};

interface AnalysisDisplayProps {
    analysis: AnalysisResult | null;
    onWordSelect: (word: AnalyzedWord) => void;
    selectedWord: AnalyzedWord | null;
}

const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ analysis, onWordSelect, selectedWord }) => {
    if (!analysis) return null;

    const createKey = (word: AnalyzedWord) => word.map(token => token[0]).join('-');

    return (
        <div className="mt-6 p-6 bg-white rounded-xl shadow-lg border border-gray-200 leading-loose text-2xl flex flex-wrap">
            {analysis.word_list.map((word, index) => {
                const surface = word.map(token => token[0]).join('');
                const reading = word.map(token => token[1]).join('');
                const pos = word[0][2];
                const colorClass = posColors[pos] || posColors["その他"];
                const isSelected = selectedWord && createKey(word) === createKey(selectedWord);

                return (
                    <span
                        key={`${index}-${surface}`}
                        onClick={() => onWordSelect(word)}
                        className={`inline-block cursor-pointer transition-all duration-200 ease-in-out m-1 p-1 rounded-md ${colorClass} ${isSelected ? 'ring-2 ring-blue-500 scale-105' : 'hover:scale-105'}`}
                    >
                        <ruby>
                            {surface}
                            <rp>(</rp><rt className="text-sm font-light">{reading}</rt><rp>)</rp>
                        </ruby>
                    </span>
                );
            })}
        </div>
    );
};

export default function App() {
    const [inputText, setInputText] = useState("吾輩は猫である。名前はまだ無い");
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [selectedWord, setSelectedWord] = useState<AnalyzedWord | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [tokenizerLoading, setTokenizerLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            loadKuromoji(setTokenizerLoading, setError);
        }
    }, []);

    const handleAnalyse = () => {
        if (!inputText.trim()) {
            setError("Please enter some text to analyze.");
            return;
        }
        if (tokenizerLoading || !kuromojiTokenizer) {
            setError("Tokenizer is not ready yet. Please wait.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setAnalysis(null);
        setSelectedWord(null);
        
        try {
            const tokens = kuromojiTokenizer.tokenize(inputText);
            const groupedTokens = groupTokens(tokens);
            setAnalysis({ word_list: groupedTokens });
        } catch (err) {
            setError("Failed to analyze text.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleWordSelect = (word: AnalyzedWord) => {
        setSelectedWord(word);
    };
    
    const handleCloseInfo = () => {
        setSelectedWord(null);
    }

    const exampleTexts = useMemo(() => ["吾輩は猫である。名前はまだ無い", "どこで生れたかとんと見当がつかぬ", "何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。"], []);

    return (
        <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6 md:p-8">
            <style>{`.animate-fade-in { animation: fade-in 0.3s ease-out forwards; } @keyframes fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <div className="max-w-4xl mx-auto">
                <Header />

                <main className="mt-8">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Enter Japanese Text</h2>
                        <textarea value={inputText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputText(e.target.value)} className="text-black w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="ここに日本語の文章を入力してください..."/>
                        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <button onClick={handleAnalyse} disabled={isLoading || tokenizerLoading} className="w-full sm:w-auto bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center shadow-lg">
                                {tokenizerLoading ? "Loading Analyzer..." : (isLoading ? "Analyzing..." : "Analyse Text!")}
                            </button>
                             <div className="text-sm text-gray-500 flex-wrap">Or try an example:
                                {exampleTexts.map(text => (<button key={text} onClick={() => setInputText(text)} className="ml-2 text-blue-500 hover:underline">`{text}`</button>))}
                            </div>
                        </div>
                        {error && <p className="mt-4 text-red-600 bg-red-100 p-3 rounded-lg">{error}</p>}
                    </div>
                    
                    {analysis && <div className="animate-fade-in"><AnalysisDisplay analysis={analysis} onWordSelect={handleWordSelect} selectedWord={selectedWord} /></div>}
                    <WordInfo selectedWord={selectedWord} onClose={handleCloseInfo} />
                </main>
            </div>
        </div>
    );
}
