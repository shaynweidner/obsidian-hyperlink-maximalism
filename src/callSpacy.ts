import { postProcessContent, ignoreStringsList } from "./plugin-helper";
const stopwords = require("stopwords-iso");
const english = new Set(stopwords.en);
const ignoreStrings = new Set(ignoreStringsList);



export async function getNounPhrases(
  text: string
): Promise<{ [key: string]: number[][] }> {
  const data = JSON.stringify({ text });

  try {
    const response = await fetch(
      "http://192.168.50.245:5000/extract_noun_phrases",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: data,
      }
    );
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const responseJson = await response.json();
    let nounPhrases = responseJson.noun_phrases;

    // Filter out common words from the noun phrases
    nounPhrases = nounPhrases.filter(
      (phrase) => !english.has(phrase.toLowerCase())
    );
    nounPhrases = nounPhrases.filter(
      (phrase) => !ignoreStrings.has(phrase.toLowerCase())
    );

    const nounPhrasesPositions = {};

    nounPhrases.forEach((phrase) => {
      const positions = [];
      phrase = postProcessContent(phrase);
      // Escape special characters for regex
      const escapedPhrase = phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`\\b${escapedPhrase}\\b`, "gi");
      let match;

      while ((match = regex.exec(text)) !== null) {
        positions.push([match.index, regex.lastIndex]);
      }

      nounPhrasesPositions[phrase] = positions;
    });

    // Return the noun phrases with their positions
    return nounPhrasesPositions;
  } catch (error) {
    console.error(`Error fetching noun phrases: ${error}`);
    throw error;
  }
}
