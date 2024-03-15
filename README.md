# NER Highlighter

Based on a [post](https://thesephist.com/posts/hyperlink/) and a [demo](https://notation.app/) from [Linus Lee](https://thesephist.com/) called Hyperlink Maximalism.  

> The computer can look at every word on the page, every phrase, name, quote, and section of text, and show me a “map” of the words and ideas behind which lay the most interesting ideas I might want to know about.

This is a work in progress.  I hope that - based on the few other individuals that were asking whether something for Obsidian like this exists, and were as disappointed as I was that it didn't - there are others that can contribute.

## Why

There are as many theories about how best to surface serendepitous connections between notes and ideas as there are people using PKMs.  Folders...tags...hyperlinks... I believe that there is no single way, but rather it depends on the individual, the topics typically studied (for lack of a better word) by the individual, the way that they think to write those ideas down (notes, mind maps, lists, etc.) and the other tools used, and the goal of the vault (organizing projects, writing research papers, etc.).  I'm not sure if this will materialize for me, but I think this one, when finished, will help me in my personal system.

## Future Enhancements
Linus wasn't clear in his method for finding which terms or phrases to highlight.  Currently I am using `spaCy`, either to generate noun chunks, or in conjunction with `sense2vec` to generate phrases.  But I think an improvement to the _what_ to has the possibility to give the most improvement to this plugin.  I'm open to ideas.  I had initially used the node `compromise` package to generate the phrases, but I wasn't impressed with the results, and the spaCy usage is good enough for the beta.

Also, in Linus's demo and post he mentions clicking or hovering over the highlighted text to see where else in the vault that text appears.  I haven't yet added this functionality.

There may be better ideas for when to build the vault-wide index for the phrases to highlight.  See Usage below.

## Usage
Currently this plugin needs an external tool to generate the phrases.  It will send a JSON payload to an API with the format `{"text": "note text here"}`, and expects a response like `{"phrases": ["here's a phrase", "here's another"]}`.  The specific API path can be specified in the plugin's settings.  I have created a [simple spaCy API repo](https://github.com/shaynweidner/simple_spacy_api) if you would like to get right to using the plugin.  In the releases there, there is an executable that should run on Windows, otherwise you'll have to clone it down and run the API yourself.

### Preview

![](https://i.imgur.com/Pxi9d2e.png)

## License

[MIT](LICENSE)
