# Hyperlink Maximalism Obisidian Plugin

Based on a [post](https://thesephist.com/posts/hyperlink/) and a [demo](https://notation.app/) from [Linus Lee](https://thesephist.com/) called Hyperlink Maximalism.  

> The computer can look at every word on the page, every phrase, name, quote, and section of text, and show me a “map” of the words and ideas behind which lay the most interesting ideas I might want to know about.

This is a work in progress.  I hope that - based on the few other individuals that were asking whether something for Obsidian like this exists, and were as disappointed as I was that it didn't - there are others that can contribute.

## Why

There are as many theories about how best to surface serendepitous connections between notes and ideas as there are people using PKMs.  Folders...tags...hyperlinks... I believe that there is no single way, but rather it depends on the individual, the topics typically studied (for lack of a better word) by the individual, the way that they think to write those ideas down (notes, mind maps, lists, etc.) and the other tools used, and the goal of the vault (organizing projects, writing research papers, etc.).  I'm not sure if this will materialize for me, but I think this one, when finished, will help me in my personal system.

## Future Enhancements
Linus wasn't clear in his method for finding which terms or phrases to highlight.  Currently I am using `spaCy`, either to generate noun chunks, or in conjunction with `sense2vec` to generate phrases.  But I think an improvement to the _what_ to highlight has the possibility to give the most improvement to this plugin.  I'm open to ideas.  I had initially used the node `compromise` package to generate the phrases, but I wasn't impressed with the results, and the spaCy usage is good enough for me for now.

There may be better ideas for when to build the vault-wide index for the phrases to highlight.  See Usage below.

## Installation
You'll have to install this with BRAT.

## Usage
Currently this plugin needs an external tool to generate the phrases, and I don't see a good way around that in the near future.  The plugin will send a JSON payload to an API with the format `{"text": "note text here"}`, and expects a response like `{"phrases": ["here's a phrase", "here's another"]}`.  The specific API path can be specified in the plugin's settings.  I have created a [simple spaCy API repo](https://github.com/shaynweidner/simple_spacy_api) if you would like to get right to using the plugin.  In the releases there, there is a PyInstaller executable that should run on Windows, otherwise you'll have to clone it down and run the API yourself.  The highlighting of the phrases is based on the prevalence of the phrase in the vault (excluding the frequency in the current note).  By default, all notes will be indexed, but there is setting where you can specify which folers you want to exclude; note that the plugin checks if any of the comma-separated strings are anywhere in the path of your notes (from the vault root and on).
Within a note, if you click on the highlighted text you will be given options.  The first menu option will be to wrap the current text in brackets to form a link, but it will note follow the link; I personally like this option as an intentional way of creating a link for a non-existent file.  The options below that will show other notes with the highlighted phrase, in descending order by the frequency; clicking that menu option will take you to the note.  For now it will open that note in the same window, but I plan to make that behavior a plugin option.

## Building the plugin
```
git clone https://github.com/shaynweidner/obsidian-hyperlink-maximalism
npm install --force #there are conflicts in the packages, but if you force it it will work
npm run build
```

### Preview

![](https://i.imgur.com/TDxdzJ2.png)

## License

[MIT](LICENSE)
