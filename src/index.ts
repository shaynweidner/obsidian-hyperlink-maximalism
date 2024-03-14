import { Plugin } from 'obsidian';
import type { Extension } from '@codemirror/state';
import { PluginHelper } from './plugin-helper';
import { Indexer } from './indexer';
import { hyperlinkMaximalismExtension } from './hyperlinkMaximalismExtension';

export default class TagsHyperlinkMaximalismPlugin extends Plugin {
  private editorExtension: Extension[] = [];
  private indexer: Indexer;

  public async onload(): Promise<void> {
    console.log('Loading Hyperlink Maximalism plugin', new Date().toLocaleString());

    const pluginHelper = new PluginHelper(this);
    this.indexer = new Indexer(pluginHelper);

    this.registerEditorExtension(this.editorExtension);
    
    pluginHelper.onFileMetadataChanged((file) => this.indexer.buildIndex());

    this.subscribeToEventsAndLoadExtensions(pluginHelper);
    await this.indexer.loadDatabase();
  }

  private subscribeToEventsAndLoadExtensions(pluginHelper: PluginHelper) {
    const applyDecorations = async () => {
        this.loadhyperlinkMaximalismExtension();
    };
    pluginHelper.onLayoutReady(applyDecorations);

    this.indexer.on('indexRebuilt', applyDecorations);
}

  private loadhyperlinkMaximalismExtension() {
    const extension = hyperlinkMaximalismExtension(this.indexer);
    this.updateEditorExtension(extension);
  }

  private updateEditorExtension(extension: Extension) {
    this.editorExtension.length = 0;
    this.editorExtension.push(extension);
    this.app.workspace.updateOptions();
  }

  public async onunload(): Promise<void> {
    await this.indexer.saveDatabase();
    console.log('Unloading Hyperlink Maximalism plugin', new Date().toLocaleString());
  }
}
