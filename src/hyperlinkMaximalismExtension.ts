import { EditorView, Decoration, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { debounce, type Debouncer } from 'obsidian';
import { Indexer } from './indexer';
import { PluginHelper, preProcessContent } from './plugin-helper';
import { getNounPhrases } from './callSpacy';
import { showSuggestionsModal } from './popup/suggestionsPopup';

const hmHighlightClass = 'hm-ngram-highlight'

const underlineDecoration = (start, end, indexKeyword, color, opacity) => {
  return Decoration.mark({
    class: hmHighlightClass,
    attributes: {
      'data-index-keyword': indexKeyword,
      'data-position-start': `${start}`,
      'data-position-end': `${end}`,
      'style': `background-color: ${color}; opacity: ${opacity};`
    }
  });
};

const calculateHighlighting = (count, max_count) => {
  count = Math.min(count, max_count);
  const grossUpFactor = 1 / (-Math.log(1 / (max_count + 1)));
  const stepOne = Math.log((1 + count) / (max_count + 1)) + 1;
  const stepTwo = 1 - stepOne;
  const stepThree = grossUpFactor * stepTwo;
  const scaleFactor = 1 - stepThree;
  const opacity = 1;

  let startRGB = { r: 0, g: 0, b: 255 };
  let endRGB = { r: 255, g: 0, b: 0 };

  const r = Math.round(startRGB.r + (endRGB.r - startRGB.r) * scaleFactor);
  const g = Math.round(startRGB.g + (endRGB.g - startRGB.g) * scaleFactor);
  const b = Math.round(startRGB.b + (endRGB.b - startRGB.b) * scaleFactor);

  const color = `rgb(${r}, ${g}, ${b})`;

  return { color, opacity };
};

export const hyperlinkMaximalismExtension = (indexer: Indexer) => {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    delayedDecorateView: Debouncer<[view: EditorView]>;
    pluginhelper: PluginHelper;
    initialDecorationApplied: boolean = false;

    constructor(view: EditorView) {
      this.decorations = Decoration.none;
      this.updateDebouncer(view);
    }

    public update(update: ViewUpdate): void {
      if (!this.initialDecorationApplied || update.docChanged || update.viewportChanged) {
        this.delayedDecorateView(update.view);
        this.initialDecorationApplied = true; // Ensure we don't repeatedly trigger initial decoration
      }
    }

    private async updateDebouncer(view: EditorView) {
      if (!this.delayedDecorateView) {
        this.delayedDecorateView = debounce(
          async (view: EditorView) => {
            this.decorateView(view).then(() => {
              try {
                // Ensure the view is updated with new decorations
                view.update([]);
              } catch (error) {
                console.error("Error decorating text:", error);
              }
            });
          },
          2000,
          true
        );
      }

      this.delayedDecorateView(view);
    }

    private async decorateView(view: EditorView): Promise<void> {
      // Wait for the layout to be ready
      await this.waitForLayoutReady();

      const entireContent = view.state.doc.toString();
      let { content: processedContent, adjustedIndices} = preProcessContent(entireContent);
      const currentFilePath = indexer.pluginHelper.activeFile?.path || "";

      try {
        const nounsAndLocs = await getNounPhrases(processedContent.toLowerCase(), indexer.settings.spaCyProtocol, indexer.settings.spaCyIP, indexer.settings.spaCyPort, indexer.settings.spaCySlug);
        let remappedNounsAndLocs1 = this.remapNounPhrasePositions(nounsAndLocs, adjustedIndices, entireContent);
        let remappedNounsAndLocs2 = await this.mergeDbNounsAndLocs(remappedNounsAndLocs1, currentFilePath);
        remappedNounsAndLocs2 = Object.fromEntries(
          Object.entries(remappedNounsAndLocs2).filter(([key, value]) => value.length > 0)
        );
        const nounPhrasesFromDb = await this.fetchNounPhrasePrevalence(remappedNounsAndLocs2, currentFilePath);

        const sortedNounPhrases = Object.entries(nounPhrasesFromDb).sort((a, b) => b[1].total - a[1].total);

        const deduplicatedNounPhrases = this.deduplicateNounPhrases(sortedNounPhrases, remappedNounsAndLocs2);

        this.applyDecorations(view, deduplicatedNounPhrases, indexer.settings.maximumColorScale);
      } catch (error) {
        console.error("Error decorating text:", error);
      }
    }

    private async waitForLayoutReady(): Promise<void> {
      while (!indexer.pluginHelper.plugin.app.workspace.layoutReady) {
        // Wait asynchronously for 100ms before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    private async fetchNounPhrasePrevalence(nounsAndLocs, currentFilePath) {
      let nounPhrasePrevalence = {};

      for (let nounPhrase of Object.keys(nounsAndLocs)) {
        let totalOccurrences = 0;
        let doc = indexer.nounPhrases.findOne({ "nounPhrase": nounPhrase });

        if (doc) {
          Object.entries(doc.files).forEach(([path, positions]) => {
            if (path !== currentFilePath) { // Exclude the current file
              totalOccurrences += positions.length;
            }
          });
        }

        nounPhrasePrevalence[nounPhrase] = { total: totalOccurrences };
      }

      return nounPhrasePrevalence;
    }

    private deduplicateNounPhrases(sortedNounPhrases, nounsAndLocs) {
      let finalNounPhrases = [];
      sortedNounPhrases.forEach(([phrase, info]) => {
          // Skip phrases with a total count of 0
          if (info.total === 0) return;
  
          const currentPhrasePositions = nounsAndLocs[phrase];
          if (!currentPhrasePositions) return;
  
          let isSubstringOfAnother = finalNounPhrases.some(finalPhraseInfo => {
              const finalPhrasePositions = nounsAndLocs[finalPhraseInfo.phrase];
              return currentPhrasePositions.some(([start, end]) =>
                  finalPhrasePositions.some(([finalStart, finalEnd]) => start >= finalStart && end <= finalEnd)
              );
          });
  
          if (!isSubstringOfAnother) {
              finalNounPhrases.push({ phrase, positions: currentPhrasePositions, total: info.total });
          }
      });
  
      return finalNounPhrases;
    }

    private applyDecorations(view: EditorView, deduplicatedNounPhrases, max_count) {
      const builder = new RangeSetBuilder<Decoration>();
  
      // Flatten all positions from deduplicatedNounPhrases into a single array and sort
      let allPositions = deduplicatedNounPhrases.flatMap(({ phrase, positions, total }) => {
        return positions.map(([start, end]) => {
          return ({
          start,
          end,
          phrase,
          ...calculateHighlighting(total, max_count)
        })
      })
      })

      allPositions = allPositions.sort((a, b) => {
        return (a.start - b.start || a.end - b.end)
      });
  
      allPositions.forEach(({ start, end, phrase, color, opacity }) => {
          builder.add(start, end, underlineDecoration(start, end, phrase, color, opacity));
      });
  
      this.decorations = builder.finish();
      view.update([]);
    }

    

    private remapNounPhrasePositions(nounsAndLocs, adjustedIndices, content) {
      const remappedNounsAndLocs = Object.entries(nounsAndLocs).reduce((acc, [phrase, positions]) => {
          const remappedPositions = positions.map(([start, end]) => {
              let newStart = adjustedIndices[start];
              let newEnd = adjustedIndices[end];

              if (adjustedIndices[end + 1] !== undefined && adjustedIndices[end + 1] > newEnd + 1) {
                  newEnd = adjustedIndices[end + 1] - 1;
              } else if (adjustedIndices[end] !== undefined) {
                  newEnd = adjustedIndices[end];
              }

              return [newStart, newEnd];
          });
          acc[phrase] = remappedPositions;
          return acc;
      }, {});

      return remappedNounsAndLocs;
    }

    private async mergeDbNounsAndLocs(remappedNounsAndLocs, currentFilePath) {
      const dbNounPhrases = indexer.nounPhrases.find({});
      dbNounPhrases.forEach(doc => {
          if (doc.files[currentFilePath]) {
              if (!remappedNounsAndLocs[doc.nounPhrase]) {
                  remappedNounsAndLocs[doc.nounPhrase] = [];
              }
              const dbPositions = doc.files[currentFilePath];
              remappedNounsAndLocs[doc.nounPhrase] = remappedNounsAndLocs[doc.nounPhrase].concat(dbPositions);
          }
        });

        Object.keys(remappedNounsAndLocs).forEach(nounPhrase => {
            let positions = remappedNounsAndLocs[nounPhrase];
            
            positions = positions.filter((pos, index, self) =>
                index === self.findIndex((t) => t[0] === pos[0] && t[1] === pos[1])
            );
            
            positions.sort((a, b) => a[0] - b[0]);
    
            remappedNounsAndLocs[nounPhrase] = positions;
        });
    
        return remappedNounsAndLocs;
    }

  }, {
    decorations: view => view.decorations,

    eventHandlers: {
      mousedown: (e: MouseEvent, view: EditorView) => {
        const target = e.target as HTMLElement;
        const isCandidate = target.classList.contains(hmHighlightClass);

        // Do nothing if user right-clicked or unrelated DOM element was clicked
        if (!isCandidate || e.button !== 0) {
          return;
        }

        // Extract position and replacement text from target element data attributes state
        const { positionStart, positionEnd, indexKeyword } = target.dataset;

        const currentFilePath = indexer.pluginHelper.activeFile?.path || "";
        const matches = indexer.nounPhrases.findOne({"nounPhrase": indexKeyword}).files;
        const suggestionsWithCounts = {};

        for (const filename in matches) {
            if (matches.hasOwnProperty(filename) && filename !== currentFilePath) {
                suggestionsWithCounts[filename] = matches[filename].length;
            }
        }

        const suggestionsWithCountsStrings = Object.keys(suggestionsWithCounts)
            .sort((a, b) => suggestionsWithCounts[b] - suggestionsWithCounts[a])
            .map(filename => `${filename}: ${suggestionsWithCounts[filename]}`);

        // Show suggestions modal
        showSuggestionsModal({
          app: indexer.pluginHelper.plugin.app,
          mouseEvent: e,
          suggestions: suggestionsWithCountsStrings,
          currentPhrase: indexKeyword,
          onClick1: (replaceText) => {
            view.dispatch({
              changes: {
                from: +positionStart,
                to: +positionEnd,
                insert: replaceText,
              },
            });
          },
          onClick2: (linkText) => {
            indexer.pluginHelper.plugin.app.workspace.openLinkText(linkText.replace(/: [^:]*$/, ''), '/', false)
          }
        });
      }
    }
  });
};