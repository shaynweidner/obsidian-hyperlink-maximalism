import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { Extension } from '@codemirror/state';
import { PluginHelper } from './plugin-helper';
import { Indexer } from './indexer';
import { hyperlinkMaximalismExtension } from './hyperlinkMaximalismExtension';

interface TagsHyperlinkMaximalismPluginSettings {
	specialChar: string;
  dbFileName: string;
  spaCyProtocol: string;
  spaCyIP: string;
  spaCyPort: string;
  spaCySlug: string;
  folder_exclusions: string[];
  minimumIndexLength: number;
  maximumColorScale: number;
}

const DEFAULT_SETTINGS: TagsHyperlinkMaximalismPluginSettings = {
	specialChar: 'đ',
  dbFileName: 'phrases.json',
  spaCyProtocol: 'http',
  spaCyIP: "127.0.0.1",
  spaCyPort: "23692",
  spaCySlug: "extract_phrases",
  folder_exclusions: [],
  minimumIndexLength: 3,
  maximumColorScale: 10,
}

class TagsHyperlinkMaximalismPluginSettingTab extends PluginSettingTab {
	plugin: TagsHyperlinkMaximalismPlugin;

	constructor(app: App, plugin: TagsHyperlinkMaximalismPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Special Character')
			.setDesc(`This should be a character that you don't expect to find in your notes.  It is used as a tool when cleaning up text before NLP.`)
			.addText(text => text
				.setPlaceholder('đ')
				.setValue(this.plugin.settings.specialChar)
				.onChange(async (value) => {
					this.plugin.settings.specialChar = value;
					await this.plugin.saveSettings();
				}));
    
    new Setting(containerEl)
      .setName('Database filename')
      .setDesc(`This is the JSON filename where your indexed phrases will be saved.  The file will be saved to and loaded from the .noun-phrases directory in the root of your vault.`)
      .addText(text => text
        .setPlaceholder('phrases.json')
        .setValue(this.plugin.settings.dbFileName)
        .onChange(async (value) => {
          this.plugin.settings.dbFileName = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('spaCy API host protocol')
      .setDesc(`This is the JSON filename where your indexed phrases will be saved.  The file will be saved to and loaded from the .noun-phrases directory in the root of your vault.`)
      .addDropdown((dropdown) => {
        dropdown
        .addOption("http", "http")
        .addOption("https", "https")
        .setValue('http')
        .onChange(async (value) => {
          this.plugin.settings.spaCyProtocol = value;
          await this.plugin.saveSettings();
        })
      });
    
    new Setting(containerEl)
      .setName('spaCy API host IP')
      .setDesc(`The IP address of the API that is hosting the NLP endpoint.`)
      .addText(text => text
        .setPlaceholder('127.0.0.1')
        .setValue(this.plugin.settings.spaCyIP)
        .onChange(async (value) => {
          this.plugin.settings.spaCyIP = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('spaCy API host PORT')
      .setDesc(`The port of the API that is hosting the NLP endpoint.`)
      .addText(text => text
        .setPlaceholder('23692')
        .setValue(this.plugin.settings.spaCyPort)
        .onChange(async (value) => {
          this.plugin.settings.spaCyPort = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('spaCy API slug')
      .setDesc(`The port of the API that is hosting the NLP endpoint.`)
      .addText(text => text
        .setPlaceholder('extract_noun_phrases')
        .setValue(this.plugin.settings.spaCySlug)
        .onChange(async (value) => {
          this.plugin.settings.spaCySlug = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Exclusion Folder(s)')
      .setDesc(`A comma-separated list of folders to exclude from indexing.`)
      .addText(text => text
        .setPlaceholder('1. Inbox')
        .setValue(this.plugin.settings.folder_exclusions.join(', '))
        .onChange(async (value) => {
          const splits = value.split(', ').map((s) => s.trim());
          this.plugin.settings.folder_exclusions = splits;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
    .setName('Minimum String Length to Index')
    .setDesc(`Any "phrases" with fewer characters then this won't be indexed or highlighted`)
    .addText(text => text
      .setPlaceholder('3')
      .setValue(this.plugin.settings.minimumIndexLength)
      .onChange(async (value) => {
        this.plugin.settings.minimumIndexLength = value;
        await this.plugin.saveSettings();
      }));
    
    new Setting(containerEl)
    .setName('Maximum for Color Scale')
    .setDesc(`The amount of instances of a string such that this quantity or more will be highlighted red.`)
    .addText(text => text
      .setPlaceholder('10')
      .setValue(this.plugin.settings.maximumColorScale)
      .onChange(async (value) => {
        this.plugin.settings.maximumColorScale = value;
        await this.plugin.saveSettings();
      }));
	}
}

export default class TagsHyperlinkMaximalismPlugin extends Plugin {
	settings: TagsHyperlinkMaximalismPlugin;
  private editorExtension: Extension[] = [];
  private indexer: Indexer;

  public async onload(): Promise<void> {
    console.log('Loading Hyperlink Maximalism plugin', new Date().toLocaleString());
		await this.loadSettings();

    const pluginHelper = new PluginHelper(this);
    this.indexer = new Indexer(pluginHelper);
    this.indexer.settings = this.settings;

    this.registerEditorExtension(this.editorExtension);
    
    pluginHelper.onFileMetadataChanged((file) => this.indexer.buildIndex());

    // will re-apply decorations. Not quite right, but re-building the index seems like overkill
    // pluginHelper.onFileMetadataChanged((file) => this.loadhyperlinkMaximalismExtension()); 

    this.subscribeToEventsAndLoadExtensions(pluginHelper);
    this.addCommand({
      id: 'build-index',
      name: "Build term database",
      callback: () => {
        this.indexer.buildIndex()
      } 
    })

    this.addCommand({
      id: 'load-index',
      name: "Load saved term database",
      callback: () => {
        this.indexer.loadDatabase()
      }
    })

    this.addCommand({
      id: 'save-index',
      name: "Save current term database",
      callback: () => {
        this.indexer.saveDatabase()
      }
    })

		
		this.addSettingTab(new TagsHyperlinkMaximalismPluginSettingTab(this.app, this));
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

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
