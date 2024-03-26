import _ from 'lodash';
import { TFile, Plugin } from 'obsidian';

export class PluginHelper {
  constructor(private plugin: Plugin) {
  }

  public get activeFile(): TFile | undefined {
    return this.plugin.app.workspace.getActiveFile();
  }

  public onLayoutReady(callback: () => void): void {
    this.plugin.app.workspace.onLayoutReady(() => callback());
  }

  public onFileMetadataChanged(callback: (file: TFile) => void): void {
    this.plugin.app.workspace.onLayoutReady(() => {
      this.plugin.registerEvent(this.plugin.app.metadataCache.on('changed', callback));
    });
  }
}

function replaceObsidianLinks(content, specialChar) {
  content = content.replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g, (match, p1, p2) => {
      const prefixLength = match.indexOf('|') + 1; 
      return specialChar.repeat(prefixLength) + p2 + specialChar.repeat(2); 
  });

  content = content.replace(/\[\[([^\|\]]+)\]\]/g, (match, p1) => {
      return specialChar.repeat(2) + p1 + specialChar.repeat(2); 
  });

  return content;
}

export const preProcessContent = (content: string) => {
  
  const indices = [...Array(content.length).keys()];

  const specialChar = 'đ';
  const replaceWithSpecialChar = (match: string) => specialChar.repeat(match.length);

  // Adding replacement for text enclosed by underscores
  content = content.replace(/_([^_]+)_/g, `${specialChar}$1${specialChar}`);


  content = content.replace(/^---[\s\S]+?---/gm, replaceWithSpecialChar);
  content = content.replace(/%%[\s\S]+?%%/gm, replaceWithSpecialChar);
  content = content.replace(/^```[\s\S]+?```/gm, replaceWithSpecialChar);
  content = content.replace(/!\[.*?\]\(data:image\/[a-zA-Z]+;base64,[^\)]+\)/g, replaceWithSpecialChar);
  content = content.replace(/(\$\$?)[^\$]+?\1/g, replaceWithSpecialChar);
  content = content.replace(/`/g, specialChar);
  content = content.replace(/#[^\s]+/g, replaceWithSpecialChar);
  content = content.replace(/^#+\s+/gm, replaceWithSpecialChar);
  content = content.replace(/\[\^\d+\](?=\s|\]|$)/g, replaceWithSpecialChar);
  content = content.replace(/^\[\^\d+\]:\s*\[\[.*\]\]\s*$/gm, replaceWithSpecialChar);
  content = content.replace(/\b\d{5,}(_\d+)*\b/g, replaceWithSpecialChar);
  content = content.replace(/\b\d{1,2}\b/g, replaceWithSpecialChar);

  content = replaceObsidianLinks(content, specialChar);

  content = content.replace(/^\n/, specialChar);
  content = content.replace(/([a-zA-Z])\(s\)/g, `$1${specialChar.repeat(3)}`);
  content = content.replace(/^>/gm, specialChar);

  let adjustedIndices = indices.filter((_, index) => content[index] !== specialChar);
  content = content.replace(new RegExp(specialChar, 'g'), '');

  return { content, adjustedIndices };
}

export const postProcessContent = (content: string) => {
  content = content.replace(/^- /, '');
  content = content.replace(/^\n+/, '');
  content = content.replace(/^"/, '');
  content = content.replace(/^\{/, '');
  content = content.replace(/^\(/, '');
  content = content.replace(/^-/, '');
  content = content.trim();

  return content;
}

export const ignoreStringsList = [
  ".",
  "-",
  "'s",
  "_"
]