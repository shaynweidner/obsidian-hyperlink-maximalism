import lokijs, { Collection } from "lokijs";
import { TypedEmitter } from "tiny-typed-emitter";
import type { PluginHelper } from "./plugin-helper";
import { preProcessContent } from "./plugin-helper";
import { getNounPhrases } from "./callSpacy";

type NounPhraseDocument = {
  nounPhrase: string;
  files: Record<string, number[]>; // Maps file paths to counts
};

interface IndexerEvents {
  indexRebuilt: () => void;
}



export class Indexer extends TypedEmitter<IndexerEvents> {
  public nounPhrases: Collection<NounPhraseDocument>;
  public db: lokijs;

  constructor(private pluginHelper: PluginHelper) {
    super();
    this.db = new lokijs("nounPhraseDB");
    this.nounPhrases = this.db.addCollection<NounPhraseDocument>(
      "nounPhrases",
      {
        indices: ["phrase"],
      }
    );
  }

  // async loadDatabase() {
  //   const filePath = "./.noun-phrases/testing.json";
  //   try {
  //     // Check if the database file exists
  //     const fileExists =
  //       await this.pluginHelper.plugin.app.vault.adapter.exists(filePath);
  //     if (fileExists) {
  //       // Read the database content from the file
  //       const dbContent = await this.pluginHelper.plugin.app.vault.adapter.read(
  //         filePath
  //       );
  //       // Initialize your database with the content
  //       this.db.loadJSON(dbContent);
  //       this.nounPhrases = this.db.getCollection("nounPhrases")
  //       console.log("Database loaded successfully");
  //       this.emit("indexLoaded");
  //     } else {
  //       console.log("Database file does not exist, creating a new one.");
  //       await this.buildIndex();
  //       // Here you can handle initializing a new database if needed
  //     }
  //   } catch (error) {
  //     console.error("Error loading database:", error);
  //   }
  // }

  // async saveDatabase() {
  //   try {
  //     // Serialize the database to a string
  //     const dbString = this.db.serialize();
  //     // Save the string to a file in the vault
  //     await this.pluginHelper.plugin.app.vault.adapter.write(
  //       "./.noun-phrases/testing.json",
  //       dbString
  //     );
  //     console.log("Database saved successfully");
  //   } catch (error) {
  //     console.error("Failed to save the database:", error);
  //   }
  // }

  public async buildIndex(): Promise<void> {
    this.db.removeCollection("nounPhrases")
    this.nounPhrases = this.db.addCollection<NounPhraseDocument>(
      "nounPhrases",
      {
        indices: ["phrase"],
      }
    );
    let distinctNounPhrases = await this.getDistinctNounPhrases()
    await this.updateNounPhraseCounts(distinctNounPhrases);
    console.log("Index rebuilt");
    this.emit("indexRebuilt");
  }

  public async getCurrentNoteNounPhrases(content : string): Promise<Set<unknown>> {
    const { content: processedContent, adjustedIndices } = preProcessContent(content);
    let temporaryData = {};
    let distinctNounPhrases = new Set();

    try {
        const nounsAndLocs = await getNounPhrases(processedContent.toLowerCase());
        Object.keys(nounsAndLocs).forEach(phrase => distinctNounPhrases.add(phrase));
        temporaryData = { originalContent: content, processedContent, adjustedIndices };
    } catch (error) {
        console.error("Error fetching noun phrases:", error);
    }

    return distinctNounPhrases;
  }

  public async getDistinctNounPhrases(): Promise<{ [key: string]: { [path: string]: number[][] } }> {
    const files = this.pluginHelper.plugin.app.vault.getMarkdownFiles();
    let temporaryData = {};
    let distinctNounPhrases = new Set();

    // Process each document
    for (const file of files) {
        if (!file.path.includes("4. Notes")) continue;
        const content = await this.pluginHelper.plugin.app.vault.read(file);
        const { content: processedContent, adjustedIndices } = preProcessContent(content);

        try {
            const nounsAndLocs = await getNounPhrases(processedContent.toLowerCase());
            Object.keys(nounsAndLocs).forEach(phrase => distinctNounPhrases.add(phrase));
            temporaryData[file.path] = { originalContent: content, processedContent, adjustedIndices };
        } catch (error) {
            console.error("Error fetching noun phrases:", error);
        }
    }

    // Find positions for each distinct noun phrase in each document's content
    let nounPhrasesConsolidated = {};
    distinctNounPhrases.forEach(phrase => {
        Object.entries(temporaryData).forEach(([path, { originalContent, processedContent, adjustedIndices }]) => {
            const positions = this.findNounPhrasePositionsInContent(phrase.toLowerCase(), processedContent.toLowerCase(), adjustedIndices, originalContent.toLowerCase(), path);
            if (positions.length > 0) {
                if (!nounPhrasesConsolidated[phrase]) {
                    nounPhrasesConsolidated[phrase] = {};
                }
                nounPhrasesConsolidated[phrase][path] = positions;
            }
        });
    });

    return nounPhrasesConsolidated;
  }

  private findNounPhrasePositionsInContent(phrase, processedContent, adjustedIndices, originalContent, path) {
    let positions = [];
    // Use the helper function logic to find start and end positions in processedContent
    const escapedPhrase = phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedPhrase}\\b`, 'gi');
    // const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    let match;
    while ((match = regex.exec(processedContent)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;        
        let newStart = adjustedIndices[start];
        let newEnd = adjustedIndices[end];
  
        // Check adjustedIndices[start - 1] is defined and its difference with adjustedIndices[end]
        if (adjustedIndices[start - 1] !== undefined && adjustedIndices[start - 1] < newStart - 1) {
          newStart = adjustedIndices[start - 1] + 1;
        }
        
        // Check if adjustedIndices[end + 1] is defined and its difference with adjustedIndices[end]
        if (adjustedIndices[end + 1] !== undefined && adjustedIndices[end + 1] > newEnd + 1) {
            newEnd = adjustedIndices[end + 1] - 1;
        }

        positions.push([newStart, newEnd]);
    }
    return positions;
  }


  private updateNounPhraseCounts(nounPhrasesConsolidated) {
    Object.entries(nounPhrasesConsolidated).forEach(([nounPhrase, filePositions]) => {
      let doc = this.nounPhrases.findOne({ nounPhrase }) || this.nounPhrases.insert({ nounPhrase, files: {} });

      Object.entries(filePositions).forEach(([path, positions]) => {
        // If the path exists, check for duplicate positions before concatenating
        if (!doc.files[path]) {
          doc.files[path] = positions;
        } else {
          // Assuming you need a mechanism to avoid duplicate position arrays
          const existingPositions = doc.files[path];
          const updatedPositions = positions.filter(pos => !existingPositions.some(ep => ep[0] === pos[0] && ep[1] === pos[1]));
          doc.files[path] = existingPositions.concat(updatedPositions);
        }
      });

      this.nounPhrases.update(doc);
    });
  }
}
