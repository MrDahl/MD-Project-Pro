# MD Project (MD-Project-Pro) – Professionelt Planlægningsværktøj til Byggebranchen 🚀

MD Project er et fuldt udstyret, moderne og yderst visuelt tidsplanlægnings- og resursestyringsværktøj – bygget i React og TypeScript – specialdesignet til danske byggeprojekter, entreprenørsager og håndværksvirksomheder. 

Med en række avancerede funktioner som automatisk beregning af **Kritisk Vej**, **vejrspildsdage**, **automatiske danske helligdage** (inklusive historisk korrekte regler for Store Bededag) og **tilbagevendende serviceopgaver**, giver det projektledere fuld kontrol over komplekse byggeprogrammer, mandskabskapacitet og budgetter.

---

## 🔗 Prøv Appen Live
Du kan tilgå og køre applikationen direkte i din browser:
👉 **[https://MrDahl.github.io/MD-Project-Pro/](https://MrDahl.github.io/MD-Project-Pro/)**

---

## ✨ Nøglefunktioner og Fuld Funktionsbeskrivelse

### 1. Interaktivt Gantt-diagram (Tidsplan) 📊
* **Tydelig Tidslinje**: Viser projektets opgaver på en løbende uge- og dagsskala med stor visuel præcision.
* **Kalendermarkering**: Weekender (grøn skravering), helligdage (lilla skravering med 🇩🇰-flag) samt uvejrs-/vejrspildsdage (blå skravering med ❄️-symbol) markeres tydeligt i baggrundsgitteret.
* **Interaktive Dage (Genvej)**: Klik direkte på en kolonne eller en dag i diagrammets overskrift for hurtigt at fjerne/tilføje en helligdag eller oprette en vejrspildsperiode for den specifikke dato.
* **Drag-and-Drop & Resizing**: Træk i midten af en opgaveblok for at forskyde startdatoen, eller træk i højre kant for at justere varigheden.
* **Zoom**: Skift mellem dag-, uge- og månedsvisning, så store projekter kan overskues på ét blik.
* **I dag-linje og hop-knapper**: En rød linje markerer dags dato, og knapperne *I dag*, *Projektstart* og *Projektslut* springer direkte derhen.
* **Afhængighedspile**: Pile fra forgænger til efterfølger viser rækkefølgen (kritisk vej i rødt) og kan slås fra.
* **Tastaturstyring**: Vælg en bjælke med Tab; piletaster flytter (Shift = 1 uge), +/− ændrer varigheden, Enter åbner detaljer, op/ned skifter opgave. Dialoger lukkes med Escape.
* **Baseline**: Gem den nuværende plan som baseline. Gantt viser den oprindelige plan som tynde skyggebjælker og afvigelsen i dage ved hver opgave, og Økonomi viser afvigelsen i slutdato og sagspris.
* **Sidepanel til opgaver**: *Opret ny opgave* og *Rediger* åbner et panel til højre, så du ikke forlader Gantt-diagrammet. Escape lukker.
* **Søg, filtrér og gruppér**: Opgavelisten kan søges (titel, noter, faggruppe), filtreres på etape, faggruppe og kritisk vej, grupperes efter etape, og opgaver kan duplikeres. Lange lister vises 100 ad gangen.
* **Advarsler**: Et panel peger på opgaver der slutter efter (eller starter før) deres etape, opgaver uden faggruppe, mulig dobbeltbooking af samme faggruppe og opgaver der ikke kunne placeres. Klik på en advarsel for at åbne opgaven.

### 2. Intelligent Planlægningsmotor (Scheduler Engine) 🧠
* **Flere forgængere**: En opgave kan have flere forgængere af typen *Slut → Start* eller *Start → Start*, hver med forsinkelse (ventetid) eller forspring (negativt tal) i kalenderdage. Opgaven starter, når den seneste betingelse er opfyldt, og den kritiske vej følger de forgængere, der afgør starten. Ældre projektfiler med én forgænger virker uændret.
* **Smarte Arbejdsdelsregler**: Systemet fravælger automatisk weekender og helligdage ved beregning af opgaveforløb. Disse begrænsninger kan slås fra pr. opgave (*Tillad weekendarbejde* eller *Arbejde på helligdage*).
* **Flerårig Helligdagsintegration**: Beregner automatisk de officielle danske helligdage for alle involverede projektår (både startår, slutår og mellemliggende år) – direkte i browseren, uden eksterne opslag.
* **Store Bededag-Logik**: Systemet tager højde for, at Store Bededag blev afskaffet som officiel helligdag i Danmark fra og med 2024. For år før 2024 medregnes den korrekt som lukkedag, mens den fra 2024 og frem udelades automatisk.

### 3. Kritisk Vej (Critical Path Method) 🔥
* **Deadlinesensitivt**: Planlægningsmotoren analyserer løbende afhængigheder og varigheder for at identificere projektets **Kritiske Vej**.
* **Visuel Identifikation**: Opgaver på den kritiske vej markeres med en iøjnefaldende rød ramme og en rød flamme (`🔥`). Forsinkelser på disse opgaver vil direkte rykke den endelige slutdato for hele projektet.

### 4. Milestones, Etaper & Projektfaser 🧱
* **Projektfaser (Etaper)**: Opret overordnede faser med faste tidsintervaller og tildel dem unikke farvekoder for at skabe et visuelt hierarki.
* **Milestones (Milepæle)**: Opret nul-dages milepæle, der vises som iøjnefaldende diamanter i tidsplanen, ideelt til vigtige delafleveringer eller myndighedsgodkendelser.

### 5. Tilbagevendende Serviceopgaver (Recurrences) ↻
* **Håndtering af Driftsopgaver**: Perfekt til ugentlige oprydninger, affaldstømninger, containerleje eller sikkerhedsrunderinger.
* **Automatiske Gentagelser**: Angiv et fast interval (f.eks. hver 7. dag), og systemet opretter automatisk hele rækken af ydelser igennem projektets eller etapens levetid.
* **Økonomisk Integration**: Tilføj en fast enhedspris pr. udførelse for løbende at medregne driftsomkostningerne i det samlede projektbudget.

### 6. Vejrforhold & Vejrspildsdage (Weather Delays) ❄️
* **Arbejdsstop**: Registrer perioder med ekstremt vejr (sne, hård frost, storm), som forhindrer udendørsarbejde.
* **Automatisk Tidsforlængelse**: Opgaver, der ikke tillader uvejrsarbejde, vil automatisk blive forlænget med antallet af vejrspildsdage, og alle efterfølgende opgaver skubbes tilsvarende.

### 7. Faggrupper, Fagområder & Økonomi (Budgetstyring) 👷💰
* **Faggrupper**: Opret og tilpas faglige teams (Tømrer, Murer, Elektriker etc.) med koder, faste timelønninger, overarbejdstakster og dagsnormer.
* **Budgetoversigt**: Samlet sagspris og planlagt deadline, udgifter fordelt pr. faggruppe og pr. opgave (løn inkl. weekend-/helligdagstillæg, faste priser og gentagende serviceydelser).
* **PDF-rapport**: Udskriv eller gem økonomioversigten som PDF direkte fra browseren.
* **S-kurve**: De akkumulerede omkostninger over tid vises som kurve (og baseline som stiplet linje).
* **Skabeloner**: Under *Nyt* kan du starte fra en færdig skabelon (nyt parcelhus, renovering af badeværelse eller tilbygning) med faggrupper, etaper, forgængere og milepæle, som du derefter tilpasser.

### 8. Nem Import & Eksport (Backup) 💾
* **JSON-Eksport**: Gem hele din projektopsætning lokalt som en `.json`-fil med ét klik.
* **JSON-Import**: Indlæs en tidligere gemt fil for øjeblikkeligt at fortsætte arbejdet eller dele tidsplanen med samarbejdspartnere.
* **Fortryd / Gentag**: Alle ændringer kan fortrydes (Ctrl+Z, Ctrl+Shift+Z/Ctrl+Y, knapperne i toppen eller "Fortryd" i beskeden efter en handling). Et helt træk i Gantt tæller som ét trin.
* **Automatisk gemt-status & sikkerhedskopi**: Projektet gemmes løbende i browseren (status vises i toppen), og appen minder dig om at downloade en sikkerhedskopi.
* **Nyt projekt**: Knappen "Nyt" starter guiden igen og spørger først, så intet overskrives ved en fejl.

---

## 🖥️ Brugerfladens Faner og Opbygning

Applikationen er inddelt i 5 faner i hovedmenuen:
1. **Tidsplan**: Skifter mellem det interaktive **Gantt**-diagram og **Opgaver** (opgavelisten, hvor du bygger og redigerer opgaver, bemanding, varigheder, forgængere og etaper).
2. **Faggrupper**: Administration af faggrupper, farver, dagsnormer og timepriser.
3. **Økonomi**: Det finansielle overblik over omkostninger og sagspris.
4. **Projekt & kalender**: Overordnede projektindstillinger (startdato, daglige arbejdstidsregler, helligdagskalender, uvejrslog) samt oprettelse og styring af **Etaper/Projektfaser**.
5. **Vidensbase (Ordliste)**: Uddybende faglige forklaringer på byggetekniske planlægningsudtryk som *Kritisk Vej*, *Forgængere*, *Slæktid/Buffer* og *Arbejdskapacitet*.

---

## ⚡ Ydeevne

Appen er bygget til at kunne håndtere store projekter med tusindvis af opgaver og afhængigheder:

* **Gantt-diagrammet tegner kun det synlige**: Rækker og dagskolonner uden for skærmen oprettes ikke i DOM'en, og baggrunden (weekender, helligdage, uvejr) er ét fælles lag. Antal DOM-elementer er dermed uafhængigt af projektets størrelse.
* **Hurtig planlægningsmotor**: Opgaverne beregnes i afhængighedsrækkefølge i ét gennemløb (5.000 sammenkædede opgaver på ca. 50 ms).
* **Gem sker forsinket**: Projektet gemmes i browserens lager kort efter, du er holdt op med at ændre, og altid når fanen lukkes eller skjules.

---

## 🛠️ Teknisk Stak

* **Framework & Sprog**: React 19 med TypeScript i `strict`-tilstand.
* **Build System**: Vite.
* **Styling**: Tailwind CSS 4.
* **Ikoner**: Lucide React.
* **Test**: Node's indbyggede testløber (`node:test`) til planlægningsmotor og helligdagsregler.

## 💻 Udvikling

```bash
npm ci          # installer afhængigheder
npm run dev     # start udviklingsserver
npm test        # kør tests
npm run lint    # typecheck (tsc)
npm run build   # produktionsbuild til dist/
```

Ved push til `main` bygger GitHub Actions appen og udgiver den på GitHub Pages.

---

*Værktøjet er udviklet med dyb respekt for byggeledelsens daglige virkelighed, hvor tidsplaner ikke blot er statiske streger, men dynamiske og komplekse planer, der påvirkes af vejr, helligdage og faglige sammenhænge.* 🛠🏗
