# Fiszki — instrukcja

Dwie aplikacje, ten sam silnik:

| | `cae-fiszki` | `slownik-pojec` |
|---|---|---|
| Do czego | przygotowanie do C1 Advanced | polskie hasła i ich znaczenia |
| Jednostka nauki | chunk: kolokacja, zwrot, konstrukcja | hasło + definicja |
| Wpisywanie odpowiedzi | domyślnie włączone | domyślnie wyłączone |
| Nowe karty dziennie | 12 | 20 |
| Talia startowa | 112 kart C1 | 24 hasła przykładowe |

---

# 1. Uruchomienie

## 1.1. Dwa repozytoria

Na koncie `mrozicki-hub` załóż dwa repozytoria:

- `cae-fiszki`
- `slownik-pojec`

**Muszą być publiczne**, jeśli masz darmowy plan — GitHub Pages dla repozytoriów prywatnych wymaga planu Pro. Publiczne repo oznacza, że Twoja lista słów i postęp nauki są widoczne dla wszystkich. Token dostępu **nie trafia do repozytorium** — siedzi wyłącznie w pamięci przeglądarki na Twoim telefonie, więc publiczność repo go nie ujawnia.

## 1.2. Wgranie plików

W każdym repozytorium: **Add file → Upload files**, przeciągnij całą zawartość odpowiedniego katalogu, **Commit changes**.

Pliki w każdym repo:

```
index.html              powłoka i układ
style.css               style, trzy palety trybów
fsrs.js                 algorytm powtórek
config.js               różnica między aplikacjami: typy kart i formularze
app.js                  silnik: kolejka, oceny, synchronizacja
cards.js                talia — to jest plik, który rozbudowujesz
progress.js             stan nauki, nadpisywany przez aplikację
reviews.js              historia powtórek, dopisywana przez aplikację
manifest.webmanifest    dane instalacji na ekranie głównym
sw.js                   obsługa offline
icon-192.png
icon-512.png
```

## 1.3. Włączenie GitHub Pages

W repozytorium: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save**.

Po minucie aplikacje są pod adresami:

- `https://mrozicki-hub.github.io/cae-fiszki/`
- `https://mrozicki-hub.github.io/slownik-pojec/`

## 1.4. Token dostępu

Jeden token wystarczy dla obu aplikacji.

**GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**

- Token name: `fiszki`
- Expiration: maksymalnie rok (zapisz sobie datę — po wygaśnięciu synchronizacja przestanie działać bez ostrzeżenia)
- Repository access: **Only select repositories** → zaznacz `cae-fiszki` i `slownik-pojec`
- Repository permissions → **Contents: Read and write** (to jedyne uprawnienie, jakiego potrzebujesz)
- Generate token, skopiuj

Nie używaj tokenu klasycznego z zakresem `repo` — daje zapis do wszystkiego, co masz na koncie. Fine-grained ogranicza szkody do dwóch repozytoriów z fiszkami.

## 1.5. Instalacja na telefonie

**iPhone:** otwórz adres w **Safari** (nie w Chrome — tylko Safari potrafi instalować PWA na iOS) → przycisk Udostępnij → **Dodaj do ekranu początkowego**.

**Android:** otwórz w Chrome → menu → **Zainstaluj aplikację**.

Aplikacja zainstalowana ma własną pamięć, niezależną od przeglądarki. **Token wpisz w zainstalowanej wersji**, nie w karcie przeglądarki — inaczej ta pierwsza nie będzie się synchronizować.

## 1.6. Podłączenie synchronizacji

W aplikacji: **Więcej → Synchronizacja z GitHubem**

- Nazwa użytkownika: `mrozicki-hub`
- Repozytorium: `cae-fiszki` (albo `slownik-pojec`)
- Gałąź: `main`
- Token: wklejony token

**Zapisz dane**, potem **Wyślij**. Jeśli w repo pojawił się commit „postęp …", działa.

Powtórz na każdym urządzeniu, którego będziesz używał.

---

# 2. Codzienne używanie

## 2.1. Sesja

Aplikacja sama układa kolejkę: zaległe powtórki wymieszane z nowymi kartami w proporcji cztery do jednego. Nie ma czegoś takiego jak „przerobienie całej talii" — masz zrobić to, co jest na dziś, i wyjść.

Sesję można przerwać w dowolnym momencie. Każda ocena zapisuje się natychmiast lokalnie, a co dwadzieścia ocen i przy schowaniu aplikacji leci na GitHub.

## 2.2. Cztery oceny

| Ocena | Kiedy | Co robi |
|---|---|---|
| **Znowu** | nie wiedziałeś | ścina stability, karta wraca za kilka minut |
| **Trudne** | wiedziałeś, ale z wysiłkiem | krótszy interwał niż zwykle |
| **Dobre** | wiedziałeś normalnie | to jest domyślna ocena, używaj jej najczęściej |
| **Łatwe** | odpowiedź przyszła natychmiast | znacznie dłuższy interwał |

Pod każdym przyciskiem widzisz, kiedy karta wróci. Nie kombinuj: jeśli odpowiedź przyszła bez wahania — Dobre. „Łatwe" tylko wtedy, gdy pytanie było wręcz irytująco proste.

Jeśli wpisałeś błędną odpowiedź, aplikacja i tak potraktuje kartę jako **Znowu**, nawet gdy klikniesz coś innego. Wpisana odpowiedź jest twardym dowodem.

## 2.3. Trzy tryby — element pod naukę w nocy

Przełącznik w prawym górnym rogu.

- **Dzień** — pełen kontrast, wpisywanie odpowiedzi, lektor.
- **Wieczór** — paleta bez niebieskiego, niższy kontrast.
- **Noc** — bursztyn na czerni, dodatkowe przyciemnienie ekranu, **wpisywanie i lektor wyłączone**, a odpowiedź odsłania się stuknięciem w dowolne miejsce karty.

Tryb Noc jest zaprojektowany dokładnie pod usypianie dziecka: jedna ręka, kciuk, żadnego światła w oczy, żadnego dźwięku, żadnej klawiatury wyskakującej z dołu ekranu. W tym trybie robisz powtórki rozpoznawcze — produkcję z wpisywaniem zostaw na dzień.

## 2.4. Gesty i klawiatura

Na telefonie:
- przesunięcie w bok na karcie zakrytej — odsłania odpowiedź
- przesunięcie **w prawo** na karcie odkrytej — Dobre
- przesunięcie **w lewo** — Znowu

Na komputerze:
- **spacja** — odsłoń, potem Dobre
- **1 / 2 / 3 / 4** — oceny
- **Enter** — sprawdź wpisaną odpowiedź

---

# 3. Dodawanie materiału

## 3.1. Pojedyncza karta — z telefonu

Zakładka **Dodaj**. Wypełnij i zapisz. Karta trafia od razu do kolejki, a przy włączonej synchronizacji jest dopisywana do `cards.js` w repozytorium.

W aplikacji CAE wybierasz typ karty. To decyduje, jak karta wygląda i czego uczy:

| Typ | Co wpisujesz w polu Pytanie | Odpowiedź | Testuje |
|---|---|---|---|
| **Luka w zdaniu** | zdanie z `___` | brakujący fragment | Use of English 1–2 |
| **Słowotwórstwo** | słowo bazowe | forma pochodna | Use of English 3 |
| **Transformacja** | zdanie wyjściowe (+ zdanie docelowe w osobnym polu) | 3–6 słów | Use of English 4 |
| **Kolokacja** | `___ a decision / an effort` | brakujący czasownik | Part 1, Writing |
| **Przyimek** | `depend ___` | przyimek | Part 2 |
| **Zwrot** | fraza po polsku | odpowiednik angielski | Writing, Speaking |
| **Definicja** | definicja po angielsku | słowo | zakres czynny |

Lukę zapisujesz jako trzy podkreślenia: `___`. Jedna luka na kartę.

## 3.2. Import zbiorczy

Pod formularzem jest pole na wklejenie wielu linii naraz.

**CAE:**
```
typ | pytanie | odpowiedź | podpowiedź | tłumaczenie | kolokacje;… | przykłady;… | uwaga
```
```
cloze|The plan ___ at the last minute.|fell through||spełznąć na niczym||The sale fell through.|Zawsze o planach, nie o rzeczach.
prep|She has a talent ___ languages.|for|||||
wordform|explain|rzeczownik|explanation|wyjaśnienie|||
```

**Pojęcia:**
```
hasło | znaczenie | kwalifikator | przykład | uwaga
```
```
Ekstrapolacja|wnioskowanie o nieznanym na podstawie znanego przedziału|mat.|Ekstrapolacja tego trendu na dekadę jest ryzykowna.|Przeciwieństwo: interpolacja.
```

Wystarczą trzy pierwsze pola w CAE i dwa w Pojęciach. Format pasuje do arkusza kalkulacyjnego — zrób kolumny w Excelu, sklej formułą z `|` i wklej.

## 3.3. Edycja z komputera

Możesz też edytować `cards.js` bezpośrednio w GitHubie. Aplikacja pobiera ten plik z sieci przy każdym uruchomieniu, więc zmiana pojawi się przy następnym otwarciu.

**Nigdy nie zmieniaj pola `id` istniejącej karty.** Identyfikator jest kluczem do historii nauki. Zmiana `id` = utrata całego postępu dla tego hasła. Treść możesz poprawiać do woli — poprawka literówki nie rusza postępu.

Żeby usunąć kartę, skasuj jej wpis z `cards.js`. Osierocony wpis w `progress.js` jest nieszkodliwy.

---

# 4. Ustawienia — co kręcić i kiedy

**Nowe karty dziennie.** Jedyny hamulec, który realnie chroni Cię przed lawiną. Przy 12 nowych dziennie obciążenie stabilizuje się po około trzech miesiącach na 70–90 powtórkach dziennie, czyli 10–15 minutach. Przy 30 nowych dziennie dojdziesz do 200+ powtórek i porzucisz to w szóstym tygodniu.

Zasada: **nie podnosisz limitu, dopóki liczba zaległych nie schodzi do zera przez dwa tygodnie z rzędu.** Po trudnym tygodniu zjedź na 5 zamiast robić przerwę — algorytm sam nadrobi.

**Docelowa retencja.** 90% to punkt wyjścia. Wyżej znaczy więcej powtórek przy tej samej talii. Miesiąc przed egzaminem podnieś na 92–95%.

**Maksymalny interwał.** 365 dni w aplikacji CAE, żeby nic nie wypadło poza horyzont przygotowań. W aplikacji Pojęcia 730, bo tam nie ma terminu.

**Wpisywanie odpowiedzi.** Zostaw włączone w CAE. To jedyna rzecz, która przekłada się bezpośrednio na Use of English i Writing — rozpoznawanie samo w sobie buduje słownictwo bierne, które na egzaminie z Ciebie nie wyjdzie. W nocy wyłącza się samo.

**Zakładka Więcej** pokazuje też prognozę obciążenia na 14 dni. Jeśli słupki rosną schodkowo w górę, zejdź z limitu nowych kart. Sekcja **Uparte** wypisuje hasła z pięcioma i więcej wpadkami — te przepisz albo skasuj, bo zjadają nieproporcjonalnie dużo czasu.

---

# 5. Synchronizacja — jak to działa

Trzy pliki w repozytorium: `cards.js` (talia), `progress.js` (stan nauki), `reviews.js` (historia).

Scalanie jest **na poziomie pojedynczej karty**, nie całego pliku. Każdy stan ma znacznik czasu ostatniej zmiany; przy pobieraniu wygrywa nowszy. To znaczy, że możesz uczyć się na telefonie i na laptopie tego samego dnia bez utraty postępu — pod warunkiem, że pobierzesz przed rozpoczęciem sesji na drugim urządzeniu.

Kiedy leci wysyłka:
- co 20 ocen
- przy schowaniu aplikacji lub zablokowaniu telefonu
- ręcznie: **Więcej → Wyślij**

Pobieranie idzie automatycznie przy starcie, jeśli jest sieć.

**Gdy nie ma sieci:** wszystko działa dalej, oceny lądują w pamięci telefonu i pójdą przy pierwszym połączeniu. Aplikacja jest w pełni offline — to jej normalny tryb pracy, nie awaryjny.

**Gdy synchronizacja zawiedzie:**
- „Błąd wysyłki: Bad credentials" — token wygasł, wygeneruj nowy
- „Błąd wysyłki: Not Found" — zła nazwa repo, albo token nie obejmuje tego repozytorium
- konflikt po edycji `cards.js` z dwóch stron naraz — najpierw **Pobierz**, potem **Wyślij**

**Więcej → Pobierz kopię** zrzuca cały stan do jednego pliku JSON. Rób to raz na miesiąc.

---

# 6. Skąd brać materiał pod CAE

Reguła nadrzędna: **karta powstaje z chunku, nie ze słowa.** Jeśli hasło da się zapisać jako `słowo = tłumaczenie`, to na poziomie C1 prawdopodobnie nie warto go wpisywać.

## 6.1. Filtr poziomu — zacznij tutaj

**English Vocabulary Profile** — `englishprofile.org/wordlists/evp`
Darmowe po rejestracji. Baza Cambridge przypisująca poziom CEFR **do konkretnych znaczeń**, nie do słów. `issue` jako „problem" jest B1, a `issue` jako „wydać, wystawić" jest C1. To jest Twoje narzędzie do odsiewania: zanim wpiszesz hasło, sprawdź, czy dane znaczenie faktycznie jest B2+. Jeśli jest A2, marnujesz powtórki.

## 6.2. Materiał egzaminacyjny

**Cambridge English — C1 Advanced** — `cambridgeenglish.org/exams-and-tests/advanced/preparation`
Darmowe oficjalne arkusze przykładowe i Handbook for Teachers. To najważniejsze źródło **wzorców**, nie słówek: zobaczysz, jakie konstrukcje wracają w Part 4, jakie prefiksy w Part 3, jak wyglądają dystraktory w Part 1. Rozwiąż jeden arkusz i zrób kartę z **każdego zadania, które pomyliłeś**. To najlepiej wycelowany materiał, jaki istnieje.

Do tego seria egzaminów próbnych: **Cambridge English Advanced 1–4** (oficjalne zbiory z prawdziwych sesji).

## 6.3. Kolokacje — najważniejsza kategoria

**ozdic.com** — darmowy słownik kolokacji oparty na Oxford Collocations Dictionary. Wpisujesz rzeczownik, dostajesz zestaw czasowników i przymiotników, z którymi chodzi w parze. To jest dokładnie treść pola „Kolokacje" w Twojej karcie.

**just-the-word.com** — sprawdzarka korpusowa. Wpisujesz frazę, dostajesz informację, czy tak się faktycznie mówi i jak często. Używaj do weryfikacji, zanim wbijesz coś do talii.

**SkELL** — `skell.sketchengine.eu`
Darmowe narzędzie korpusowe. Trzy zakładki: przykładowe zdania z prawdziwych tekstów, word sketch (z czym słowo się łączy), similar words. **Najlepsze darmowe źródło autentycznych zdań przykładowych** do pola „Użycie". Nie wymyślaj zdań sam — weź je stąd.

**Academic Collocation List** — darmowy PDF (Ackermann & Chen). Trzon kolokacji języka akademickiego, czyli tego, którym pisze się esej CAE.

## 6.4. Czasowniki frazowe

**PHaVE List** (Garnier & Schmitt) — darmowy PDF. 150 najczęstszych phrasal verbs z podziałem na **znaczenia** i ich udziałem procentowym. Kluczowe: `take on` ma sześć znaczeń, ale dwa z nich pokrywają 70% użyć. Ucz się tych dwóch, nie sześciu.

**English Phrasal Verbs in Use Advanced** (Cambridge) — jeśli wolisz książkę.

## 6.5. Słowniki referencyjne

**Cambridge Dictionary** — `dictionary.cambridge.org`. Etykiety CEFR przy znaczeniach, IPA brytyjska i amerykańska, przykłady.
**Longman DOCE** — `ldoceonline.com`. Definicje w ograniczonym słownictwie, świetne do pola „Definicja → słowo".
**Reverso Context / Linguee** — do pola z tłumaczeniem polskim. Traktuj z rezerwą: to tłumaczenia maszynowe i unijne dokumenty, bywa nienaturalnie.

## 6.6. Książki, jeśli chcesz gotowy program

Kolejność od najbardziej opłacalnej:

1. **Destination C1 & C2** (Macmillan) — najgęstszy materiał pod Use of English, dużo ćwiczeń na słowotwórstwo i przyimki
2. **English Collocations in Use Advanced** (Cambridge)
3. **Advanced Grammar in Use** (Cambridge) — pod transformacje z Part 4
4. **English Idioms in Use Advanced**
5. **Complete Advanced** albo **Objective Advanced** — pełny kurs, jeśli chcesz strukturę tygodnia

## 6.7. Materiał autentyczny — i tu masz przewagę

Najlepiej trzymają się karty ze zdań, które faktycznie przeczytałeś. Twoje zainteresowania mapują się na to dobrze:

- **The Economist** — gęsty, idiomatyczny, dokładnie ten rejestr, którego wymaga esej CAE. Jeden artykuł tygodniowo wystarczy.
- **Financial Times**, **The Guardian** — gospodarka i polityka
- **BBC Sport**, **The Athletic** — F1 i NBA; sport ma własne, mocno idiomatyczne słownictwo (`come from behind`, `edge out`, `a commanding lead`)
- **BBC Learning English** — 6 Minute English i English at Work; krótkie, z transkrypcją, dobre pod Listening

Zasada higieny: **maksymalnie 5 kart z jednego artykułu.** Nie próbuj wycisnąć wszystkiego — wybierz to, co powtórzyło się już wcześniej albo od razu widzisz, gdzie byś tego użył.

---

# 7. Jak zamienić źródło w karty

Ręczne wypełnianie ośmiu pól dla każdego hasła jest nie do utrzymania przy Twoim grafiku. Wąskie gardło to nie nauka, tylko przygotowanie materiału — więc je zautomatyzuj.

Zbieraj hasła w ciągu tygodnia byle gdzie (notatka w telefonie, jedno słowo na linię). W niedzielę wrzuć całą listę do Claude'a z takim poleceniem:

> Jesteś lektorem przygotowującym do Cambridge C1 Advanced. Poniżej lista angielskich haseł.
>
> Dla każdego wygeneruj jedną linię w formacie:
> `typ|pytanie|odpowiedź|podpowiedź|tłumaczenie polskie|kolokacja;kolokacja|przykład|uwaga`
>
> Typ dobierz z: cloze, wordform, transform, coll, prep, phrase, def — ten, który najlepiej testuje dane hasło.
> Dla `cloze` pytanie to naturalne zdanie z `___` w miejscu całego chunku; luka ma być rozwiązywalna z kontekstu.
> Przykłady bierz z autentycznego użycia, brytyjski angielski, rejestr prasowy lub akademicki.
> W polu uwaga podaj pułapkę: mylone słowo, wymagany przyimek, ograniczenie rejestru. Jeśli nie ma pułapki, zostaw puste.
> Pomiń hasła poniżej poziomu B2. Bez nagłówków, bez numeracji, sama treść, jedna linia na hasło.
>
> Hasła:

Wynik wklejasz w **Dodaj → Import zbiorczy**. Zanim zatwierdzisz, przejrzyj — generowanie bywa zbyt kreatywne przy rzadkich kolokacjach, a wątpliwe warto sprawdzić na just-the-word.com.

Ten sam schemat działa dla polskich pojęć, z prostszym formatem `hasło|znaczenie|kwalifikator|przykład|uwaga`.

---

# 8. Pierwszy miesiąc

**Tydzień 1.** Nic nie dodawaj. Przerabiaj 112 kart startowych po 12 nowych dziennie i sprawdź, czy rytm w ogóle wchodzi w Twój dzień. Jedyne zadanie: dwie sesje dziennie po 5 minut, rano i wieczorem.

**Tydzień 2.** Rozwiąż jeden oficjalny arkusz Use of English z Cambridge. Z każdego błędu zrób kartę. To da 15–25 kart wycelowanych dokładnie w Twoje luki — dużo lepszych niż jakakolwiek gotowa lista.

**Tydzień 3.** Uruchom cotygodniowe zbieranie: jeden artykuł z Economista, maksymalnie 5 haseł. W niedzielę przepuść przez prompt z sekcji 7 i zaimportuj.

**Tydzień 4.** Zajrzyj do zakładki Więcej. Jeśli retencja 30-dniowa jest poniżej 85% — zejdź z limitu nowych kart. Powyżej 93% — możesz podnieść. Sekcja Uparte pokaże, co przepisać.

Docelowo: **1500–2000 chunków** przerobionych do egzaminu. Przy 12 nowych dziennie to około pięciu miesięcy. Przy 20 — trzy, ale wtedy dzienne obciążenie rośnie do 130–150 powtórek i musisz mieć na to realne 20 minut.

---

# 9. Aktualizacja aplikacji

Gdy podmienisz `app.js`, `style.css` albo `index.html`, podnieś numer wersji w pierwszej linii `sw.js`:

```js
var VERSION = 'v2';
```

Bez tego telefon będzie serwował starą wersję z pamięci podręcznej. Pliki `cards.js`, `progress.js` i `reviews.js` są zawsze pobierane z sieci, więc ich to nie dotyczy.

Silnik jest wspólny dla obu aplikacji. Aktualizując, kopiuj `fsrs.js`, `app.js`, `style.css`, `index.html` i `sw.js` do obu repozytoriów. Różnią się wyłącznie `config.js` i `cards.js`.
