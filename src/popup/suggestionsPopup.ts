import { App, Menu, MenuItem, addIcon } from 'obsidian';

type SuggestionsModalProps = {
  app: App;
  mouseEvent: MouseEvent;
  suggestions: string[];
  currentPhrase: string;
  onClick1: (replaceText: string) => void;
  onClick2: (linkText: string) => void;
};

const item = (icon, title, click) => {
  return (item: MenuItem) => item.setIcon(icon).setTitle(title).onClick(click);;
};

// My attempt at recreating the `square-arrow-out-up-right` lucide icon.
addIcon("goto", `<path d="M 40,5 L 5,5 L 5,95 L 95,95 L 95,60 L 90,60 L 90,90 L 10,90 L 10,10 L 40,10 Z" /><path d="M 60,5 L 95,5 L 95,40 L 90,40 L 90,10 L 60,10 Z" /><path d="M 47.5,50 L 92.5,5 L 95.5,8 L 50.5,53 Z" />`);

export const showSuggestionsModal = (props: SuggestionsModalProps): void => {
  const { app, mouseEvent, suggestions, currentPhrase, onClick1, onClick2 } = props;

  setTimeout(() => {
    const menu = new Menu(app);

    menu.addItem(
        item('pencil', `replace with [[${currentPhrase}]]`, () => {
            onClick1(`[[${currentPhrase}]]`);
        })
        );

    suggestions.forEach((linkText) => {
      menu.addItem(
        item('goto', `Go to: ${linkText}`, () => {
            onClick2(linkText);
        }
        )
      );
    });

    menu.addSeparator();
    menu.showAtMouseEvent(mouseEvent);
  }, 100);
};