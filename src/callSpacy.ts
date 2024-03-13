import * as http from 'http';
import * as dns from 'dns';
import { postProcessContent, ignoreStringsList } from "./plugin-helper";
const stopwords = require('stopwords-iso');
const english = new Set(stopwords.en);
const ignoreStrings = new Set(ignoreStringsList);


// Set default result order for DNS resolution to prioritize IPv4
dns.setDefaultResultOrder('ipv4first');

export async function getNounPhrases(text: string): Promise<{[key: string]: number[][]}> {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ text });

        const options = {
            hostname: '192.168.50.245',
            port: 5000,
            path: '/extract_noun_phrases',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            let responseBody = '';

            res.on('data', (chunk) => {
                responseBody += chunk;
            });

            res.on('end', () => {
                try {
                    const responseJson = JSON.parse(responseBody);
                    let nounPhrases = responseJson.noun_phrases;
                    
                    // Filter out common words from the noun phrases
                    nounPhrases = nounPhrases.filter(phrase => !english.has(phrase.toLowerCase()));
                    nounPhrases = nounPhrases.filter(phrase => !ignoreStrings.has(phrase.toLowerCase()));

                    const nounPhrasesPositions = {};

                    nounPhrases.forEach((phrase) => {
                        const positions = [];
                        phrase = postProcessContent(phrase);
                        // Escape special characters for regex
                        const escapedPhrase = phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        const regex = new RegExp(`\\b${escapedPhrase}\\b`, 'gi');
                        let match;

                        while ((match = regex.exec(text)) !== null) {
                            positions.push([match.index, regex.lastIndex]);
                        }

                        nounPhrasesPositions[phrase] = positions;
                    });

                    // Return the noun phrases with their positions
                    resolve(nounPhrasesPositions);
                } catch (error) {
                    console.log(`Error from text: ${text}`);
                    reject(new Error(`Error parsing JSON response from spaCy API: ${error}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}