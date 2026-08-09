# slownik-pojec

Aplikacja do nauki polskich haseł i ich znaczeń. Działa offline, instaluje się na ekranie głównym, synchronizuje postęp przez GitHub API.

**Adres:** https://mrozicki-hub.github.io/slownik-pojec/

## Co robi

- Algorytm powtórek **FSRS-5**
- Dwa kierunki: hasło → znaczenie (rozpoznawanie) oraz znaczenie → hasło (produkcja, z wpisywaniem)
- Obsługa haseł wieloznacznych — osobna karta na każde znaczenie
- Kwalifikatory: filoz., praw., daw., pot.
- Szybkie dodawanie z telefonu, z zapisem prosto do repozytorium
- Tryb nocny do nauki po ciemku

## Pliki

| Plik | Rola |
|---|---|
| `cards.js` | hasła — jedyny plik, który edytujesz ręcznie |
| `config.js` | model hasła, renderowanie, formularze |
| `app.js` | silnik: kolejka, oceny, synchronizacja |
| `fsrs.js` | algorytm powtórek |
| `progress.js` | stan nauki (generowany) |
| `reviews.js` | historia powtórek (generowana) |
| `sw.js` | obsługa offline — podnieś `VERSION` po zmianie kodu |

## Zaczynasz od zera?

Podmień zawartość `cards.js` na:

```js
window.CARDS = [];
```

## Zasada nadrzędna

**Nigdy nie zmieniaj pola `id` istniejącej karty.** To klucz do historii nauki.

Pełna instrukcja: `INSTRUKCJA.md`.
