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

### 2. Intelligent Planlægningsmotor (Scheduler Engine) 🧠
* **Finish-to-Start Afhængigheder**: Mulighed for at knytte opgaver sammen (forgængere), så efterfølgende opgaver automatisk skubbes eller trækkes i tidsplanen.
* **Smarte Arbejdsdelsregler**: Systemet fravælger automatisk weekender og helligdage ved beregning af opgaveforløb. Disse begrænsninger kan slås fra pr. opgave (*Tillad weekendarbejde* eller *Arbejde på helligdage*).
* **Flerårig Helligdagsintegration**: Henter automatisk officielle helligdage for alle involverede projektår (både startår, slutår og mellemliggende år).
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

### 7. Resurser, Fagområder & Økonomi (Budgetstyring) 👷💰
* **Faggrupper**: Opret og tilpas faglige teams (Tømrer, Murer, Elektriker etc.) med koder, faste timelønninger, overarbejdstakster og dagsnormer.
* **Avanceret Budgetoversigt**: Omfattende økonomisk instrumentbræt tids- og omkostningsfordelt via interaktive diagrammer (**Recharts**):
  * Akkumulerede udgifter over tid.
  * Fordeling af omkostninger på etaper og særskilte faggrupper.
  * Opdeling mellem løn-, materiale-, kørsels- og etapeudgifter samt faste abonnementsomkostninger (fra tilbagevendende ydelser).

### 8. Nem Import & Eksport (Backup) 💾
* **JSON-Eksport**: Gem hele din projektopsætning lokalt som en `.json`-fil med ét klik.
* **JSON-Import**: Indlæs en tidligere gemt fil for øjeblikkeligt at fortsætte arbejdet eller dele tidsplanen med samarbejdspartnere.

---

## 🖥️ Brugerfladens Faner og Opbygning

Applikationen er inddelt i 6 funktionelle sider, der nemt tilgås via hovedmenuen:
1. **Opgaver**: Byg og rediger projektets opgaveliste, angiv bemanding, varigheder, forgængere og etaper.
2. **Gantt**: Det fulde og interaktive visuelle planlægningskort over byggeriet.
3. **Resurser**: Administration af faggrupper, farver, dagsnormer og timepriser.
4. **Økonomi**: Det finansielle kontrolcenter med grafer over omkostningsforløb og budgettal.
5. **Projekt**: Overordnede projektindstillinger (startdato, daglige arbejdstidsregler, helligdagskalender, uvejrslog) samt oprettelse og styring af **Etaper/Projektfaser**.
6. **Vidensbase (Ordliste)**: Uddybende faglige forklaringer på byggetekniske planlægningsudtryk som *Kritisk Vej*, *Forgængere*, *Slæktid/Buffer* og *Arbejdskapacitet*.

---

## 🛠️ Teknisk Stak

* **Framework & Sprog**: React 18+ med fuld TypeScript type-sikkerhed.
* **Build System**: Vite (lynhurtigt og strømlinet udviklingsmiljø).
* **Styling**: Tailwind CSS (fuldt responsivt, moderne og detaljeret design).
* **Animationer**: `motion/react` (bløde og flydende overgange ved skift af sider, modals og tidsplaner).
* **Interaktive Grafer**: Recharts (velegnet til økonomisk data og akkumulerede kurver).
* **Ikoner**: Lucide React.
* **Server-Modul (Valgfri)**: Express-backend forberedt til sikker håndtering af eksterne API-opslag (f.eks. mod Kalendarium API eller vejr-tjenester) uden at eksponere nøgler til klienten.

---

*Værktøjet er udviklet med dyb respekt for byggeledelsens daglige virkelighed, hvor tidsplaner ikke blot er statiske streger, men dynamiske og komplekse planer, der påvirkes af vejr, helligdage og faglige sammenhænge.* 🛠🏗
